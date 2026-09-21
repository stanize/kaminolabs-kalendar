# Workflow: WhatsApp Booking

Patients book an appointment entirely inside a WhatsApp conversation with the
clinic's own WhatsApp number — a second front door onto the same booking
engine the website uses, not a parallel booking system. Originated from a
requirements spec Arun brought from a separate planning session
(2026-09-21); verified against actual code and revised below before any
build starts.

## Step: data-model
Status: in_progress
Criteria:
- CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-09-21) — pending
  live testing (running schema_subset_009.sql against the live DB, then
  exercising the tables via the rest of the feature). Tables created in
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
Status: in_progress
Criteria:
- CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-09-21) — pending
  live testing against a real Twilio (sandbox) webhook. Route at
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
- CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-09-21) — pending
  live testing (a real WhatsApp conversation through Twilio sandbox, all
  branches: happy path, slot-taken race, cancel, timeout reset, unrecognized
  reply). State machine in `lib/whatsapp/conversation.ts`, session
  persistence in `lib/whatsapp/session.ts` (30-min timeout as designed).
  Reuses `getAvailableSlots` and `getPublicBookingData`
  (`lib/actions/booking.ts` / `lib/booking/data.ts`, the same functions the
  public wizard uses) for date/time listing, and `submitBookingInternal`
  (same file) for the actual `kalendar_bookings` insert on Confirm — the
  admin-tooling entry point that skips the public per-IP rate limit, since a
  WhatsApp webhook has no meaningful end-user IP to rate-limit by; the
  unique-slot-index race is still caught and handled with a re-prompt as
  designed.
- **NATIVE INTERACTIVE MESSAGES UPGRADE (2026-09-21, second pass) — PARTIAL,
  pending live testing.** Follow-up to the deviation flagged below: swapped
  the reply-sending layer (`lib/whatsapp/twilio-client.ts` +
  `app/api/whatsapp/webhook/route.ts`) to use Twilio's Content API for real
  tappable WhatsApp UI where it could be verified safe to build; the
  conversation state machine itself (`lib/whatsapp/conversation.ts`,
  `lib/whatsapp/session.ts`) is unchanged in shape.
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
  - **NOT SHIPPED: twilio/list-picker for the service/date/time lists —
    still plain numbered-list text via TwiML (`twimlReply`), unchanged.**
    **Re-attempted in a third pass (2026-09-21), still not shipped**, this
    time starting from a real twilio-node usage example (a GitHub issue
    snippet showing `contentVariables: JSON.stringify({ body, button,
    items })` sent fresh per message against one static, once-created
    ContentSid — the "items are per-send, not per-template" question from
    the earlier passes). That resolved the *send-time* shape question, but
    the *template-creation* payload — what `types["twilio/list-picker"]`
    must contain in the POST that creates the ContentSid in the first
    place — is still unverified, and this pass found real contradicting
    evidence rather than just a gap:
    - Doc access is still blocked, confirmed two independent ways this
      time: both the WebFetch tool and a direct `curl` to
      `www.twilio.com/docs/content/twiliolist-picker` (and to a
      Postman-hosted mirror of the same page) got `CONNECT tunnel failed,
      response 403` from this session's own egress proxy — an org-policy
      `connect_rejected`, not a transient failure (checked via
      `curl $HTTPS_PROXY/__agentproxy/status`).
    - A web-search snippet attributed to Twilio's own list-picker doc shows
      `items` as real static values baked in at creation time (e.g.
      `{"id": "SFO1337", "description": "Owl Air Flight 1337 to LGA"}`, no
      `{{n}}` placeholder) — which contradicts items being dynamic per
      send if taken at face value for a template meant to be reused with
      different items every message (our case: a different service/date/
      time list every time).
    - The GitHub issue this pass started from as its strongest evidence
      (twilio/twilio-node#1065, "Supplying Items to a list template does
      not work (validation errors)") is itself an open bug report that the
      per-send items-array approach fails validation for real users — the
      one shape that looked most confirmed is independently documented as
      unreliable in production, not merely unverified.
    Given contradictory and partly-broken evidence (not just an
    information gap), shipping this untested risks breaking the
    service/date/time steps — the actual core of the conversation, unlike
    the one-shot Confirm/Cancel step — so it was left as TwiML text again,
    per this feature's standing instruction to fall back cleanly rather
    than guess. Text lists for service/date/time selection are unchanged.
    Existing list-size caps already respect WhatsApp's 10-item list-picker
    limit with no code change needed if/when this ships:
    `MAX_DATE_OPTIONS = 7`, `MAX_TIME_OPTIONS = 9`
    (`lib/whatsapp/conversation.ts`). **Action needed to finish this
    properly**: a session with actual doc access, or Arun confirming the
    exact creation payload from the Twilio console/his own account,
    followed by a real test send against Twilio sandbox before trusting
    any shape — the search evidence above is not enough on its own to
    write and ship this blind. See `lib/whatsapp/twilio-client.ts`'s
    doc comment above `getOrCreateQuickReplyContentSid` for the full
    per-pass research trail.
  - Schema: added `kalendar_whatsapp_config.quick_reply_content_sid`
    (nullable text, additive) — `supabase/schema_subset_010.sql` (folded
    into `schema_001.sql` too). No list-picker sid column, since that part
    wasn't built. Arun still needs to run `schema_subset_010.sql` against
    the live DB before the quick-reply path will work (same as the other
    still-`in_progress` schema pieces on this workflow).
  - What Arun should expect to see change when testing: the **Confirm /
    Cancel step now renders as two real tappable WhatsApp buttons**
    instead of "1. Confirmar / 2. Cancelar" text (first time it's sent for
    a given business, Twilio needs a moment to approve/register the
    template — if it doesn't render as buttons instantly, that's likely
    why, retry). Service/date/time selection still look exactly the same
    as before this pass — plain numbered text, reply with a digit.
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
Status: in_progress
Criteria:
- CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-09-21) — pending
  live/manual testing in the panel. New section rendered under
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
