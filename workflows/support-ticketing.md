# Support ticketing — Kalendar Support Framework (v1)

Arun's own workflow today: Bea reports requirements/feedback via WhatsApp,
Arun tracks it manually and works through it ad hoc. Goal: turn this into
a real (if simple, for now) two-sided ticket system — Bea raises tickets
herself in `/panel/support`, Arun manages all tickets (including ones she
reports over WhatsApp) from the admin portal, both sides can exchange
comments on a ticket, and Claude can read ticket data across sessions to
help work through them. This is meant to grow into the general Kalendar
Support Framework, not stay Bea-specific — nothing below is hardcoded to
one clinic.

## Current state (verified against real code before designing)

- `/panel/support` (`app/panel/support/page.tsx`) already lets a clinic
  submit ONE ticket: category/subject/description/up to 5 image
  attachments → `submitSupportTicket` (`lib/actions/support.ts`) → one
  row in `kalendar_support_tickets`. No ticket history/list is shown to
  the user afterward — just a static "sent" confirmation.
- `kalendar_support_tickets` already has `status` (open/in_progress/
  resolved/closed) and `admin_notes` columns, but **nothing in the
  codebase ever reads or writes them** — pure write-once-by-the-user
  today.
- The admin portal has no tickets page at all — only an aggregate
  "open tickets" count on the business dashboard, no drill-down,
  no status control, no comment/reply mechanism.
- RLS on the table is wide open (`using (true)` / `with check (true)`
  on both select and insert) — no per-business ownership enforcement.
- `support-attachments` storage bucket exists and is written to, but
  the stored URLs are never rendered anywhere (admin or user side).
- No i18n dictionary for this feature — all copy is hardcoded Spanish
  strings in the page/action files.

## Decisions (confirmed with Arun before building)

- **Comments are two-way and visible** — a real comment thread per
  ticket, both the clinic and admin post to the same thread (not a
  private admin-only notes field). Matches "meaningful exchange."
- **Admin-raised tickets (logged from a WhatsApp conversation) are
  still visible to the clinic** in their own Soporte panel, not a
  separate internal-only track — one single source of truth, and Bea
  can still reply/follow along on something Arun logged for her.
- **Claude gets a read API** — a new secret-gated internal endpoint in
  the main repo, same shape as the existing `/api/internal/schema` and
  `/api/internal/migrations` admin-portal-to-main-repo pattern, so a
  future session can pull ticket + comment data directly instead of
  needing a manual export each time.

## Data model

### `kalendar_support_tickets` — extend, don't replace

Keeps `id`/`user_id`/`user_email`/`subject`/`description`/`category`/
`status`/`attachments`/`created_at`/`updated_at`. Changes:

- **Drop `admin_notes`** — replaced entirely by the new comments table
  below (a single free-text field doesn't fit "two-way exchange").
- **Add `reported_via`** — new enum `support_ticket_source`
  (`'panel'`, `'whatsapp'`, `'email'`, `'phone'`, `'other'`). Default
  `'panel'` (self-raised); an admin-raised ticket sets this to whatever
  channel the feedback actually came through — `'whatsapp'` for Bea's
  case.
- **Add `created_by_admin_email`** (nullable text) — set only when an
  admin raised the ticket on the clinic's behalf, for audit/attribution
  (mirrors the pattern already used for `kalendar_admin_audit_log`
  actor tracking). Null for a self-raised ticket.
- `user_id`/`user_email` still identify **whose ticket it is** (the
  clinic/business it's about) in both cases — an admin-raised ticket
  still belongs to Bea's account, it's just marked how it got there.

### New table: `kalendar_support_ticket_comments`

```sql
create type public.support_comment_author_type as enum ('clinic', 'admin');

create table public.kalendar_support_ticket_comments (
  id          uuid        primary key default gen_random_uuid(),
  ticket_id   uuid        not null references public.kalendar_support_tickets (id) on delete cascade,
  author_type public.support_comment_author_type not null,
  -- Clinic comment: the posting user's own name/email (from session).
  -- Admin comment: the admin's email (same actor-tracking shape as
  -- kalendar_admin_audit_log), name optional.
  author_name  text,
  author_email text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index kalendar_support_ticket_comments_ticket_id_idx
  on public.kalendar_support_ticket_comments (ticket_id);
```

Every status change is **also** logged as a system-authored comment
(e.g. "Estado cambiado a: En progreso") so the thread is a complete,
chronological record of everything that happened on the ticket — not
just human messages. (`author_type` could gain a `'system'` value for
this, or it's simplest to just post it as an `'admin'` comment with a
recognizable body prefix — worth deciding at build time, not a blocker
for the design.)

### RLS tightening

Both `kalendar_support_tickets` and the new comments table get real
ownership policies instead of `using (true)`: a clinic can select/
insert on tickets/comments where `user_id` matches their own session
(mirrors every other `kalendar_*` table's existing pattern — though
note this app's established convention is actually app-layer
authorization via the service-role key, not RLS as the real boundary;
keep RLS reasonably tight anyway as defense in depth, consistent with
what's already on this table).

## Server actions (`lib/actions/support.ts`)

- `submitSupportTicket` — existing, unchanged behavior for the clinic
  self-raise path (`reported_via` defaults to `'panel'`).
- `getMyTickets(userId)` — new: list the caller's own tickets +
  comment counts/latest status, for the new panel-side ticket list.
- `getTicketWithComments(ticketId)` — new: full ticket + its comment
  thread, ownership-checked against the caller's session.
- `addTicketComment({ticketId, body})` — new: clinic posts a reply
  (author_type `'clinic'`).

## Panel side (`/panel/support`)

- Existing submit form stays (category/subject/description/
  attachments), unchanged.
- New: a list of the clinic's own past tickets above/alongside the
  form — subject, status pill, last-updated — clicking one opens a
  side panel (same shell as everywhere else in this app) showing the
  full description, attachments, and comment thread, with a reply box
  at the bottom.
- i18n: new `lib/i18n/dictionaries/support.ts`, matching the pattern
  every other panel feature already follows — current hardcoded
  Spanish strings get moved there (and get an English counterpart for
  free, consistent with the project's i18n-ready convention).

## Admin portal side (new `/admin/support`)

- **List view**: every ticket across all businesses — filterable by
  status/category/reported_via, searchable by business name or
  subject. Each row: business, subject, category, status pill, source
  (panel/WhatsApp/etc.), last activity time.
- **Detail view**: full ticket (description, attachments rendered
  inline — currently stored but never shown anywhere, this is the
  first place they'd actually be visible), comment thread, a reply
  box (author_type `'admin'`), and a status dropdown (changing it also
  posts the system comment described above).
- **"Raise on behalf" form**: new ticket creation from the admin side
  — pick the business (Bea's, or any other clinic going forward),
  fill subject/description/category, set `reported_via` (defaults to
  `'whatsapp'` given Arun's actual workflow, but selectable), sets
  `created_by_admin_email` to the logged-in admin. Appears in the
  clinic's own panel exactly like a self-raised ticket, per the
  decision above.
- Business dashboard's existing "Open support tickets" count becomes a
  real link into this filtered list instead of a dead-end number.

## Claude's access — internal read API

New `app/api/internal/support-tickets/route.ts` in the **main** repo
(not the admin repo), gated by a new `INTERNAL_SUPPORT_API_SECRET` env
var — same bearer-token-header pattern as
`app/api/internal/schema/route.ts` and
`app/api/internal/migrations/route.ts`. Read-only:
- `GET /api/internal/support-tickets` — list tickets (with filters:
  status, business).
- `GET /api/internal/support-tickets/:id` — one ticket + its full
  comment thread.

No write capability — Claude reads ticket context to help design/
discuss/prioritize work, Arun (or Bea) does all actual replying and
status-changing through the real UIs. The secret gets added to Vercel
env + given to a Claude session on request, same operational pattern
as `INTERNAL_SCHEMA_API_SECRET`.

## Scope notes / explicitly not in v1

- No email notifications when a ticket is updated (both sides would
  need to check the panel/admin portal to see new activity) — flagged
  as a natural next step, not building it now.
- No ticket categories/fields beyond what already exists
  (billing/technical/feature_request/account/other) — if the "Support
  Framework" grows to need SLAs, priority levels, assignment, etc.,
  that's a later design pass once the basic two-sided flow is proven
  out.
- No rich text in comments — plain text only, matching every other
  free-text field in this app (Notas, admin audit notes, etc.).
- Server-side category/file-type validation hardening (currently
  trusts the client beyond the storage bucket's own MIME allowlist) —
  worth doing alongside this work since the file's already being
  touched, not a separate pass.

## Status

Status: in_progress (2026-11-06) — code implemented in both repos,
typechecked/linted/built clean. Pending Arun's live testing + running
`schema_subset_037.sql` against the live DB (via the admin
Run-migrations tool).

IMPLEMENTED:
- **Schema** (`schema_subset_037.sql`): `reported_via`/
  `created_by_admin_email` added to `kalendar_support_tickets`,
  `admin_notes` dropped, new `kalendar_support_ticket_comments` table +
  `support_ticket_source`/`support_comment_author_type` enums.
- **Main repo** (`lib/actions/support.ts`): `submitSupportTicket`
  unchanged behavior (now `reported_via: 'panel'`), new
  `getMyTickets`/`getTicketWithComments`/`addTicketComment`, all
  ownership-scoped to the caller's session.
- **Panel** (`/panel/support`, `components/panel/support-manager.tsx`):
  submit form is now a side panel (was a full-page form); new ticket
  list + detail/reply side panel. New
  `lib/i18n/dictionaries/support.ts` (es/en) — all copy moved off
  hardcoded strings.
- **Internal read API** (`app/api/internal/support-tickets/route.ts` +
  `.../[id]/route.ts`), gated by new `INTERNAL_SUPPORT_API_SECRET` —
  for a Claude session's cross-session ticket access, not used by the
  admin portal itself (it has its own direct Supabase client, same as
  `error-log.ts`).
- **Admin portal** (`kaminolabs-kalendar-admin`, new `/admin/support`):
  `lib/admin/support.ts` (list/get/addComment/setStatus/
  createTicketOnBehalf/listBusinessOptions), list page with status/
  category/subject filters, expandable row → detail + comment thread +
  status dropdown + reply box, "+ Raise ticket on behalf" form
  (business picker, reported_via, category, subject, description).
  Sidebar link added. The business dashboard's "Open support tickets"
  count is now a real link into this list (filtered to that business),
  not a dead number.

Still needs: `schema_subset_037.sql` run against the live DB; live-test
submit → appears in admin list → admin replies/changes status →
clinic sees the update and can reply back → thread stays in sync both
ways; "raise on behalf" creates a ticket that shows up correctly in
the clinic's own panel with the "logged by..." note.

ADDED 2026-11-06 (CODE IMPLEMENTED, typechecked/linted/built clean,
PENDING TESTING):
- **Admin ticket detail → side panel**: both `/admin/support` and the
  new clinic Configuration > Support tab (admin repo's
  `clinic-config-readonly-view` step, workflows/admin-portal-tools.md)
  now open ticket detail in a slide-in side panel
  (`components/admin/side-panel.tsx` + `support-ticket-panel.tsx`)
  instead of an expandable table row — same visual pattern as the main
  repo's panel convention. One shared `SupportTicketPanel` component
  backs both call sites.
- **Pasted image attachments on replies**: new
  `kalendar_support_ticket_comments.attachments text[]` column
  (`schema_subset_038.sql`, also NOT YET RUN against the live DB).
  `addTicketComment` (main repo) now takes `FormData` instead of a
  plain object; both the clinic reply box and the admin reply box
  handle `onPaste`, upload any pasted image to the `support-attachments`
  bucket (same validation as a ticket's own initial attachments), and
  render thumbnails on existing comments.

Still needs (in addition to the above): `schema_subset_038.sql` run
against the live DB (comment replies with a pasted image will error on
the missing column until then); live-test paste-an-image-into-reply on
both the clinic panel and the admin side panel; confirm the new side
panel behaves correctly on mobile widths (admin repo's sidebar is
`md:w-56`, side panel uses `md:left-56` to match).
