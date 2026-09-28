-- ============================================================================
-- schema_subset_019.sql — workflows/admin-portal-tools.md's customer-dashboard
--
-- STANDALONE INCREMENT — NOT cumulative with any other schema_subset_*.sql
-- file. Assumes supabase/schema_001.sql and every earlier schema_subset_*.sql
-- have already run against this database. Purely additive (new table, new
-- columns with safe defaults) — no existing table is dropped or has data at
-- risk, and every statement is idempotent (safe to re-run).
--
-- Does NOT touch kalendar_businesses.slug, slug_status, slug_flag_reason,
-- slug_reviewed_at, or slug_reviewed_by — those stay exactly as they are
-- today; /admin/slugs.ts's moderation queue is untouched by this change.
--
-- The exact same DDL below is ALSO folded into supabase/schema_001.sql so a
-- full from-scratch rebuild via schema_001.sql still produces the complete
-- schema on its own.
-- ============================================================================

-- ── kalendar_slug_history ────────────────────────────────────────────────
-- Retired slug strings — written whenever an admin changes a business's
-- slug, so the old string can never be silently reclaimed by an unrelated
-- future signup. See workflows/admin-portal-tools.md, customer-dashboard
-- step, section 3, for the full delink/relink/delete-forever lifecycle.
create table if not exists public.kalendar_slug_history (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null, -- the retired string
  business_id uuid        references public.kalendar_businesses (id) on delete set null, -- who it used to belong to
  note        text        not null, -- admin's reason, required
  changed_by  text,                 -- admin user id who made the change
  created_at  timestamptz not null default now()
);

-- Only one "currently retired, not yet reclaimed" row per slug string.
-- Once relinked or delete-forever'd, the row is deleted (not archived), so
-- an old changed-away-from-then-relinked slug can be retired again later
-- without violating this.
create unique index if not exists kalendar_slug_history_slug_idx
  on public.kalendar_slug_history (slug);

alter table public.kalendar_slug_history enable row level security;

create policy "SlugHistory: write"
  on public.kalendar_slug_history for all using (true) with check (true);

-- ── kalendar_businesses.slug_active ─────────────────────────────────────
-- Slug-scoped public-page visibility toggle — deliberately NOT a general
-- business active/disabled flag (see workflow doc, "additional signals"
-- section). Manual admin toggle only for now; wiring to automatic
-- subscription-lapse enforcement is a future step.
alter table public.kalendar_businesses
  add column if not exists slug_active boolean not null default true;

-- ── kalendar_bookings.booking_channel / status_updated_at ────────────────
-- Activity-tracking signals (workflow doc, section 5). booking_channel
-- distinguishes a clinic's own manually-created booking from a guest
-- self-service one — today both produce an identical-looking row.
-- status_updated_at is touched ONLY by the explicit clinic actions that
-- change a booking's status (cancel/confirm/mark result) — deliberately
-- not the generic updated_at, which also moves on unrelated edits like
-- notes or payment marking.
alter table public.kalendar_bookings
  add column if not exists booking_channel text
    check (booking_channel in ('public_web', 'whatsapp', 'panel_manual'));

alter table public.kalendar_bookings
  add column if not exists status_updated_at timestamptz;
