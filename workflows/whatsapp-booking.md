# Workflow: WhatsApp Booking

Patients book an appointment entirely inside a WhatsApp conversation with the
clinic's own WhatsApp number — a second front door onto the same booking
engine the website uses, not a parallel booking system. Originated from a
requirements spec Arun brought from a separate planning session
(2026-09-21); verified against actual code and revised below before any
build starts.

**Demo (2026-09-22) has happened.** The freeze note below is historical —
Arun asked, post-demo, to build the list-picker follow-up it deferred.
That reopens **conversation-flow only**, scoped specifically to the
service-selection list-picker addition (see "SHIPPED: whatsapp/card LIST
for service selection" below) — not a full re-test of the rest of the
step, which stays as Arun tested it on 2026-09-21.

~~FROZEN (2026-09-21) for a client demo tomorrow (2026-09-22): the flow
below (service/date/time as numbered text, Confirm/Cancel as real
tappable buttons) is Arun-tested and confirmed working live via Twilio
Sandbox. Deliberately staying as-is — do not touch conversation-flow,
webhook-routing, settings-ui, or data-model before the demo. The
list-picker (tappable service/date/time) upgrade is the one known
follow-up, explicitly deferred — see the NOT SHIPPED note under
conversation-flow.~~

## Step: data-model
Status: done
Criteria:
- TESTED (2026-09-21, Arun): confirmed working live — schema_subset_009.sql
  run against the live DB, WhatsApp config saves correctly from
  `/panel/business` for the test clinic. Freezing here for a client demo
  tomorrow (2026-09-22) — no further changes to this step until after that.
- CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-09-21). Tables created in
  `supabase/schema_001.sql` (folded in) and `supabase/schema_subset_009.sql`
  (standalone, next after schema_subset_008.sql). Encryption implemented in
  application code (`lib/whatsapp/crypto.ts`, Node `node:crypto` AES-256-GCM,
  key from `WHATSAPP_CONFIG_ENCRYPTION_KEY` env var — NOT pgcrypto/pgsodium
  in SQL, so the key never touches the DB layer at all) — a deliberate
  variation from this step's original criteria text below, which proposed
  pgcrypto/pgsodium; the app-layer approach was judged simpler and keeps the
  key fully out of SQL. `WHATSAPP_CONFIG_ENCRYPTION_KEY` still needs to be
  set in Vercel env vars before this can work live — not yet added to the
  Environment Variables table in CLAUDE.md as part of this pass; flag for a
  RESYNC.md pass.
- New tables, following the `kalendar_` prefix convention (spec's draft
  used bare `whatsapp_config`/`whatsapp_sessions` — corrected):
  `kalendar_whatsapp_config` and `kalendar_whatsapp_sessions`.
- `kalendar_whatsapp_config`: one row per business. `business_id` (FK to
  `kalendar_businesses`, unique), `enabled` boolean, `twilio_account_sid`,
  `twilio_auth_token` (**encrypted at rest** — DECISION (2026-09-21, Arun):
  encrypt now, not deferred; no existing encryption-at-rest pattern exists
  anywhere else in the repo — grepped `encrypt|pgsodium|vault` across
  `supabase/`+`lib/`, zero hits — so this is genuinely new: use
  `pgsodium`/`pgcrypto` column encryption, decrypt only server-side at the
  point of making a Twilio API call, never logged/returned to the client),
  `twilio_whatsapp_number` (E.164), `is_sandbox` boolean, timestamps.
- `kalendar_whatsapp_sessions`: one row per (business, patient phone) —
  `business_id`, `phone_number` (E.164, from Twilio's `From`), `state`
  (`awaiting_service | awaiting_date | awaiting_time | awaiting_confirmation
  | completed | expired`), `selected_service_id` (FK
  `kalendar_services`), `selected_date`, `selected_time`,
  `last_message_at`, timestamps. **No `pending_booking_id` column** — see
  conversation-flow step below, this was in the original spec draft and is
  removed.
- RLS: follow the existing business-scoped pattern (owner-scoped read/write
  via service-role key from server actions, same as every other
  `kalendar_*` table — no new pattern needed here).
- Folded into `schema_001.sql` in its normal place, plus a standalone
  `schema_subset_NNN.sql` (next sequential number, check `ls supabase/`)
  since this runs against the live DB — per CLAUDE.md's migration
  convention.

## Step: hold-mechanics-correction
Status: done
Criteria:
- DECISION (2026-09-21, verified against code): the original spec's §7
  ("slot hold mechanics," a `pending`/held booking row created at
  `awaiting_confirmation` with a 10-minute expiry) does not match how the
  website actually works and is dropped entirely. There is no "hold"
  concept anywhere in the current booking flow — double-booking
  prevention is purely the DB-level unique partial index
  `kalendar_bookings_active_slot_idx` on
  `(business_id, coalesce(team_member_id, all-zero uuid), starts_at)
  where status in ('pending_confirmation', 'confirmed')`. A booking row
  is only ever created at final submit, and for guests it's created
  already `confirmed` (no more 24h pending-review window — that was
  removed along with `sweep-expired-bookings`).
- Consequence for this feature: `kalendar_whatsapp_sessions` tracks
  selection state only (service/date/time), no booking row and nothing
  reserved while the patient is mid-conversation. The `kalendar_bookings`
  row is created (as `confirmed`, same as a guest website booking) only
  when the patient taps **Confirm** in step 6 of conversation-flow below.
  If another channel (website, or a different WhatsApp session) took that
  exact slot first, the insert hits the unique index and fails — the bot
  must catch that and re-prompt ("that slot was just taken, pick
  another") rather than anything hold/expiry-related. Same race handling
  the website already relies on, nothing new to build there.
- No new `kalendar_bookings` status is needed — `pending_confirmation`
  stays in the enum (still used elsewhere: patient self-cancel, owner
  booking-detail actions) but this feature doesn't need it.

## Step: webhook-routing
Status: done
Criteria:
- TESTED (2026-09-21, Arun): confirmed working live against Twilio's WhatsApp
  Sandbox — webhook URL registered in the Twilio console, signature
  validation passing, business correctly resolved by `To` number. Freezing
  here for a client demo tomorrow (2026-09-22) — no further changes to this
  step until after that.
- CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-09-21). Route at
  `app/api/whatsapp/webhook/route.ts`, business resolved by matching `To`
  against `kalendar_whatsapp_config.twilio_whatsapp_number`
  (`lib/whatsapp/twilio-client.ts` + the route). Signature validated via the
  Twilio Node SDK's `twilio.validateRequest` using the resolved business's
  own decrypted auth token, checked against the exact
  `NEXT_PUBLIC_APP_URL`-derived webhook URL — this must match byte-for-byte
  what's configured in the Twilio console (trailing slash, protocol, host)
  or every request fails; worth confirming carefully during live testing.
- DECISION (2026-09-21, Arun, researched): sticking with the **per-clinic
  Twilio account model** — each clinic creates and owns their own Twilio
  account, gets their own WhatsApp number, and pastes their own
  credentials into Kalendar (see settings-ui step below). Explicitly
  NOT building the shared-single-number / Twilio ISV Tech Provider
  subaccount-provisioning model discussed and researched during design —
  that's real market practice for scale, but Arun's call: revisit only
  once subscription volume justifies it ("not something breaking my head
  with 5-10 clients"). Noted here so a future session doesn't silently
  re-decide this — see Notes below for the fuller trade-off writeup.
- Single webhook URL for ALL clinics: `app/api/whatsapp/webhook/route.ts`
  (Next.js Route Handler, `export async function POST(request: Request)`
  — matches existing convention, e.g.
  `app/api/internal/appointment-gen/route.ts`, all `app/api/cron/*`
  routes). Twilio's inbound payload always carries the receiving number
  in the `To` field (`whatsapp:+34XXXXXXXXX`) — business is resolved by
  looking up `kalendar_whatsapp_config` where `twilio_whatsapp_number`
  matches `To`. No Twilio subaccounts needed for this model.
- Incoming webhook validation: verify `X-Twilio-Signature` on every
  request (Twilio Node SDK's `twilio.validateRequest`) before processing
  — rejects spoofed calls that could otherwise create fake bookings.
  Each clinic's own `twilio_auth_token` (decrypted) is the signing
  secret used to validate requests claiming to be for that clinic.

## Step: conversation-flow
Status: in_progress
Criteria:
- TESTED (2026-09-21, Arun): confirmed working live end-to-end through
  Twilio's WhatsApp Sandbox — service → date → time → confirm produces a
  real `kalendar_bookings` row, Confirm/Cancel renders as real tappable
  WhatsApp buttons. This part of the step was Arun-tested and is NOT being
  re-tested as part of the list-picker addition below.
- **REOPENED (2026-09-22, fourth pass) for the service-list-picker addition
  — CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES, pending Arun's live
  testing.** Back to `in_progress` per CLAUDE.md's rule (code merged in a
  coding session is never marked `done` by that session) — only the
  service-selection step changed; date/time/confirm behavior is unchanged
  from the 2026-09-21 tested state above.
- CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-09-21). State machine in `lib/whatsapp/conversation.ts`, session
  persistence in `lib/whatsapp/session.ts` (30-min timeout as designed).
  Reuses `getAvailableSlots` and `getPublicBookingData`
  (`lib/actions/booking.ts` / `lib/booking/data.ts`, the same functions the
  public wizard uses) for date/time listing, and `submitBookingInternal`
  (same file) for the actual `kalendar_bookings` insert on Confirm — the
  admin-tooling entry point that skips the public per-IP rate limit, since a
  WhatsApp webhook has no meaningful end-user IP to rate-limit by; the
  unique-slot-index race is still caught and handled with a re-prompt as
  designed.
- **NATIVE INTERACTIVE MESSAGES UPGRADE — cumulative status (fourth pass,
  2026-09-22).** Follow-up to the deviation flagged below: swapped the
  reply-sending layer (`lib/whatsapp/twilio-client.ts` +
  `app/api/whatsapp/webhook/route.ts`) to use Twilio's Content API for real
  tappable WhatsApp UI where it could be verified safe to build; the
  conversation state machine itself (`lib/whatsapp/conversation.ts`,
  `lib/whatsapp/session.ts`) is unchanged in shape throughout all passes.
  - **SHIPPED: twilio/quick-reply for the Confirm/Cancel step.** At
    `awaiting_confirmation`, the webhook route now sends a real native
    Confirm/Cancel WhatsApp message via the Content API
    (`sendQuickReplyMessage` in `twilio-client.ts`) instead of TwiML text —
    two static buttons (`id: "confirm"`/`"cancel"`), created once per
    business on first use and cached (see schema note below), never
    recreated per message. Confirmed this shape via multiple independent
    web-search sources (Twilio's own quick-reply docs excerpts + community
    posts) since it's a static, low-risk shape — two fixed button
    labels/ids, no dynamic per-item content, so there was nothing here that
    required guessing. Inbound button taps arrive as Twilio's
    `ButtonPayload` form field ("confirm"/"cancel"), read in the webhook
    route and passed into `handleIncomingMessage`; `parseConfirmChoice` in
    `conversation.ts` accepts either that or the legacy "1"/"2" text digit
    (kept for backward compatibility with a session that started before
    this upgrade, or any client that doesn't render quick-reply buttons).
    Sending switched from synchronous TwiML to an async REST call
    (`client.messages.create` with `contentSid`/`contentVariables`) for
    this one step only, then the webhook responds with an empty
    `<Response/>` so Twilio doesn't also send the plain-text version.
  - **SHIPPED (2026-09-22, fourth pass): whatsapp/card LIST for the
    SERVICE-selection step only.** The blocker from the second and third
    passes below (an unverifiable/contradictory template-creation payload)
    is now resolved — Arun supplied a concrete, correct working example
    from real Twilio reference material, not web search. Two corrections
    to what the earlier passes had assumed:
    - The correct content type is **`whatsapp/card`** with
      `actions: [{ type: "LIST", ... }]`, not `twilio/list-picker` — the
      wrong type name in every prior attempt.
    - Rows ARE baked into the template at creation time (static), not sent
      per-message via `contentVariables` — the second pass's web-search
      snippet showing static items was actually correct, and the
      "items-are-dynamic-per-send" theory (built off a twilio-node GitHub
      issue in the third pass) was the wrong track.
    Because rows are static-at-creation, and our service/date/time lists
    are genuinely dynamic per conversation, a template is only reusable
    for content that doesn't change every message. That's true of a
    business's **service list** (stable, same problem shape as
    Confirm/Cancel — create once per business, cache the sid) but not of
    **date/time lists** (different every conversation). So this pass ships
    the service list only:
    - `getOrCreateServiceListContentSid` / `sendServiceListMessage`
      (`lib/whatsapp/twilio-client.ts`) mirror the quick-reply pattern:
      created lazily on first use per business, sid cached on
      `kalendar_whatsapp_config.service_list_content_sid`, never recreated
      per message.
    - **Known limitation, deliberately not solved this pass**: the cached
      template is NOT invalidated when the business's services change
      later (renamed/added/removed) — it keeps showing the services as
      they were at first use until the cached sid is cleared by hand.
      Staleness detection was explicitly out of scope to keep this pass
      scoped; flagged here rather than silently wrong.
    - **Known limitation**: a service name longer than the list's 24-char
      row-title limit is hard-truncated with an ellipsis (`truncate()` in
      `twilio-client.ts`), not solved with smarter wrapping — acceptable
      for now, flagged rather than silently broken. Not expected to bite
      today's known service names, but not verified against every
      business's actual service names either.
    - Row `id`s are `svc_<kalendar_services.id>` — the webhook reads the
      tapped row back via Twilio's `ListId` form field
      (`app/api/whatsapp/webhook/route.ts`), `parseServiceListId` strips
      the prefix to recover the exact service id directly (no
      digit-matching needed for this step anymore). Falls back to the
      legacy numbered-text digit reply for a stale session that predates
      this upgrade, or a client that doesn't render list messages, exactly
      the same fallback pattern as Confirm/Cancel's `ButtonPayload`.
    - Existing 10-row cap already applied (`services.slice(0, 10)` in
      `getOrCreateServiceListContentSid`); no clinic currently has more
      than 10 active services so this hasn't been exercised for real, but
      it fails safe (extra services just don't appear in the list) rather
      than erroring.
  - **SHIPPED (2026-09-22, fifth pass): whatsapp/card LIST for DATE and
    TIME selection.** Supersedes the "NOT SHIPPED" note that used to be
    here — the prior pass's architecture blocker (static-at-creation rows
    can't fit genuinely-per-conversation content without an unacceptable
    per-message template-creation cost) is resolved. Arun supplied a
    concrete working reference showing the correct shape for dynamic
    content: a template with **numbered placeholders** (`{{1}}`, `{{2}}`,
    ... `{{n}}`) for the body text AND every row's id/title/description,
    created **once per business** (static, reusable — same lazy-create +
    cache pattern as quick-reply/service-list), with the real per-send
    values injected via `contentVariables` on every send — never a new
    template per message. This is a different shape from the service list
    (whose rows are baked in at creation time): here the template only has
    placeholders, and all real content is per-send.
    - `getOrCreateDateListContentSid` / `sendDateListMessage` and
      `getOrCreateTimeListContentSid` / `sendTimeListMessage`
      (`lib/whatsapp/twilio-client.ts`) mirror the existing lazy-create/cache
      pattern: sid cached on `kalendar_whatsapp_config.date_list_content_sid`
      / `time_list_content_sid`, created at most once per business.
    - **Row-count design decision**: each template's placeholder count is
      fixed at creation, so it's sized to the conversation's actual max —
      **7 rows for the date template, 9 for the time template**, matching
      `MAX_DATE_OPTIONS = 7` / `MAX_TIME_OPTIONS = 9`
      (`lib/whatsapp/conversation.ts`), both already within WhatsApp's
      10-row cap. These constants are duplicated (not imported) in
      `twilio-client.ts` to avoid a circular import with `conversation.ts`
      — flagged in both files' comments to keep them in sync if either
      changes.
    - **Body text placeholder**: the date-list body shows the previously
      selected service name (`{{1}}` = service name); the time-list body
      shows the previously selected date (`{{1}}` = formatted date label) —
      judged the most useful confirmation-of-context for each step.
    - **Fewer-than-max slots — known limitation, NOT verified live**: when
      a real send has fewer options than the template's row count (e.g. 3
      open dates out of the 7-row date template), unused row slots are
      filled with a sentinel id (`date_unused_<n>` / `time_unused_<n>`,
      which never matches a real option so a tap re-prompts like any other
      invalid input) and a literal filler title ("(no disponible)") rather
      than left blank — an empty string was considered but risked either a
      blank-looking row or a template-creation validation error (WhatsApp's
      row title has a minimum length), so a visible-but-inert filler row
      was the safer choice for something that couldn't be tested against
      live Twilio. **This needs to be checked in Arun's live testing** —
      if it renders badly (e.g. genuinely confusing rather than clearly
      inert), the fallback is documenting it as a known limitation rather
      than a deeper fix (e.g. multiple differently-sized templates), per
      this pass's scope.
    - Row `id`s are `date_<YYYY-MM-DD>` / `time_<slot startIso>` — the
      webhook reads the tapped row back via `ListId`
      (`parseDateListId`/`parseTimeListId` in `twilio-client.ts`, same
      pattern as `parseServiceListId`). Falls back to the legacy
      numbered-text digit reply for a stale session, a client that doesn't
      render list messages, or a tap that doesn't resolve to a real option
      (including the filler rows above) — same fallback pattern used
      everywhere else in this flow.
    - Confirm/Cancel and service selection are unchanged by this pass — not
      touched.
  - Schema: added `kalendar_whatsapp_config.quick_reply_content_sid`
    (nullable text, additive, third pass), `service_list_content_sid`
    (nullable text, additive, fourth pass), and now also
    `date_list_content_sid` + `time_list_content_sid` (nullable text,
    additive, this pass) — `supabase/schema_subset_010.sql`,
    `supabase/schema_subset_011.sql`, and
    `supabase/schema_subset_013.sql` respectively (all folded into
    `schema_001.sql` too; there is no `schema_subset_012.sql`). **Arun
    still needs to run `schema_subset_013.sql` against the live DB**
    before the date/time list path will work — `010`/`011` should already
    be applied from prior passes; if not, run all three in order
    (010 → 011 → 013).
  - **Known, separately-tracked follow-up — service-list cache staleness
    (carried over unchanged, not touched this pass)**: the cached
    `service_list_content_sid` template is NOT invalidated when the
    business's services change later. Arun said he wants to revisit this
    later — deliberately not attempted in this pass either.
  - What Arun should expect to see change when testing: **all four steps
    now render as real tappable WhatsApp list/button messages** — service,
    date, and time as `whatsapp/card` LIST menus, Confirm/Cancel as
    quick-reply buttons. First send of a given template for a business
    needs a moment for Twilio to approve/register it, same caveat as
    before. Specifically check: (1) date/time lists show the right rows in
    the right order, (2) tapping a row advances the conversation exactly
    like the old numbered-text digit reply did, (3) a day/time with fewer
    real options than the template's max doesn't look broken — this is the
    one genuinely unverified piece from this pass.
- DEVIATION FROM ORIGINAL SPEC SHAPE, first build pass (superseded above for
  the Confirm/Cancel step only): replies were plain numbered-list text via
  TwiML (`lib/whatsapp/twilio-client.ts`'s `twimlReply`), not Twilio's native
  WhatsApp interactive list/button messages (Content API templates), because
  the current Twilio Node SDK's exact method shapes/template setup for
  WhatsApp interactive content were not confidently known and guessing at a
  payload shape was flagged as a real risk. Still true for service/date/time
  lists per the note above; resolved for Confirm/Cancel.
- State machine per `kalendar_whatsapp_sessions.state`, unchanged in
  shape from the original spec's §6 except where hold-mechanics-correction
  above removes the hold step:
  1. First message (no session, or session found but `last_message_at`
     older than the session-timeout window) → create/reset session at
     `awaiting_service`, send interactive list of the clinic's active
     `kalendar_services`.
  2. `awaiting_service` → tap stores `selected_service_id`, advance to
     `awaiting_date`, send next-N-days-with-open-slots list (reuse
     existing slot-availability logic, whatever the site's actual
     function/module is — confirm exact path at build time).
  3. `awaiting_date` → tap stores `selected_date`, advance to
     `awaiting_time`, send available times for that date+service.
  4. `awaiting_time` → tap stores `selected_time`, advance directly to
     `awaiting_confirmation` (no hold row created here, unlike the
     original spec), send a summary with Confirm/Cancel buttons.
  5. `awaiting_confirmation`:
     - Confirm → attempt to insert the `kalendar_bookings` row as
       `confirmed`. Success → session state `completed`, send
       confirmation message. Unique-index conflict (someone else took
       the slot) → re-prompt with fresh available times for that
       date/service, stay in `awaiting_time`.
     - Cancel → DECISION (2026-09-21, Arun, agreed with recommendation):
       reset session to `awaiting_service` rather than ending the
       conversation, so the patient can immediately try a different
       slot with minimal friction. No held resource to release (per
       hold-mechanics-correction), so this is a pure state reset.
  6. Any unrecognized/out-of-band reply at any state → short clarifying
     re-prompt with the same options again, never a silent error.
- Session timeout: proposed 30 minutes of inactivity before a new
  message is treated as a fresh conversation rather than resuming a
  stale one (unchanged from original spec's §8, not revisited in this
  design pass — fine as a starting number, adjust after real usage).

## Step: settings-ui
Status: done
Criteria:
- TESTED (2026-09-21, Arun): confirmed working live — WhatsApp section on
  `/panel/business` saves correctly (toggle, Account SID, Auth Token,
  number), sandbox badge correctly auto-detected. Freezing here for a
  client demo tomorrow (2026-09-22) — no further changes to this step
  until after that.
- CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-09-21). New section rendered under
  `/panel/business` (`components/panel/whatsapp-settings.tsx`, wired into
  `app/panel/business/page.tsx` below the existing `BusinessForm`, shown
  only once a business exists). Server actions in `lib/actions/whatsapp.ts`
  (`getWhatsappConfig`, `saveWhatsappConfig`), both wrapped in
  `authedAction`. Auth token is write-only from the client — the read action
  never returns the decrypted (or even encrypted) token, only a
  `hasAuthToken` boolean, and leaving the token field blank on save keeps
  the existing stored value rather than clearing it. `is_sandbox` is
  derived automatically by matching the entered number against Twilio's
  known sandbox number, not manually settable, as designed. Spanish copy
  added to `lib/i18n/dictionaries/business.ts`'s new `whatsapp` section (plus
  English, following that file's existing es/en pattern). New `whatsapp`
  icon added to `components/ui/icon.tsx` (maps to lucide's `MessageCircle` —
  lucide has no dedicated WhatsApp glyph).
- DECISION (2026-09-21, Arun) — CORRECTED from the original spec: lives
  under `/panel/business`, not `/panel/settings`. Per CLAUDE.md's
  conventions, `/panel/settings` is explicitly reserved for future
  app/account-level settings; business-scoped config belongs at
  `/panel/business`, and WhatsApp config is per-business.
  New section/tab there where a clinic admin:
  - Toggles WhatsApp booking on/off (`kalendar_whatsapp_config.enabled`)
  - Enters their Twilio Account SID, Auth Token, WhatsApp number
  - Sees read-only sandbox/production status (`is_sandbox`, set based on
    which type of number/flag, not manually editable)
- Not in scope: guided in-app Twilio account creation — clinic sets up
  Twilio externally, pastes credentials in. Document as a manual step
  (onboarding doc or direct guidance from Arun) in a follow-up, not part
  of this build.

## Step: production-readiness
Status: not_started
Criteria:
- Build and fully test against Twilio's WhatsApp **Sandbox** first — for
  the current single test client, sandbox is sufficient (one-time
  "join <code>" message from her number, then normal conversation works;
  Twilio-added "sent from your trial account" prefix is expected/fine for
  testing).
- Going live with a real clinic = swapping that clinic's
  `kalendar_whatsapp_config` row to production credentials once their own
  Meta Business verification completes — no code change required, per
  original spec's §4.

## Notes / Deviations
- **Shared-number model — considered, explicitly deferred, not built.**
  During design, discussed replacing per-clinic Twilio accounts with one
  Kalendar-owned WhatsApp number routing by a per-clinic code/deep-link,
  and separately researched the actual market-standard version of that
  idea (Twilio's WhatsApp "ISV Tech Provider" program — one platform-level
  Twilio/Meta partnership, but each clinic still gets its own dedicated
  number/WhatsApp identity via a Twilio *subaccount* provisioned through
  Kalendar's admin, so patients still see "their clinic," not a shared
  third party; WhatsApp's platform rules don't allow multiple distinct
  businesses to share one WhatsApp Business Account/sender identity
  anyway, which is why a flat single-shared-number model isn't really
  viable at scale). Arun's decision: not worth building now for 5-10
  clients — stick with clinics owning their own top-level Twilio account
  (this file's actual design, above). Revisit the subaccount-provisioning
  model once subscription volume justifies the extra build/ops
  complexity of provisioning and billing WhatsApp on clinics' behalf.
- Non-goals carried over unchanged from the original spec: no
  cancel/reschedule via WhatsApp (new bookings only, v1), website stays
  fully unchanged as its own independent channel, no free-text NLP
  (list/button taps only), no proactive WhatsApp reminders in this spec
  (existing pg_cron reminder system is separate territory).
- Original spec source: user-uploaded "WhatsApp Booking — Requirements
  Spec" (2026-09-21), written by a planning session with no code access.
  Verified against `supabase/schema_001.sql` and `lib/actions/*.ts` at
  the start of this design pass per its own instruction; table names,
  hold mechanics, webhook routing, and settings-UI placement were all
  corrected from the original draft as documented in the steps above.
