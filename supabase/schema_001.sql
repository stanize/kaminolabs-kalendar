-- ============================================================================
-- Kalendar — database schema (consolidated)
-- ============================================================================
-- Usage:
--   1. Open Supabase SQL Editor -> New query.
--   2. Paste this entire file and run it.
--   3. Follow SETUP.md for Auth, Google OAuth, and env var configuration.
--
-- Conventions:
--   * All tables are prefixed with "kalendar_".
--   * All identifiers and stored enum/code values are in ENGLISH so the project
--     is portable to any country without code changes. Country-specific display
--     copy lives only in the UI label layer, never in the database.
--   * Better Auth owns "user", "session", "account", "verification".
--   * Every table with a user-scoped column carries an ON DELETE CASCADE FK to
--     public."user"(id) in this same file.
--   * All app DB access uses the Supabase service-role key (Better Auth does not
--     issue Supabase JWTs), so RLS is the not the authorization boundary — the
--     app layer is. RLS stays enabled with permissive policies; the service-role
--     key bypasses them. The real authz check happens in server actions.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Drop existing tables (cascade removes dependent objects: policies, indexes).
-- Children before parents.
-- ----------------------------------------------------------------------------
drop table if exists public.kalendar_stripe_webhook_events       cascade;
drop table if exists public.kalendar_discount_schedule_phases    cascade;
drop table if exists public.kalendar_discount_schedule_templates cascade;
drop table if exists public.kalendar_plan_prices                 cascade;
drop table if exists public.kalendar_presales_codes   cascade;
drop table if exists public.kalendar_support_tickets  cascade;
drop table if exists public.kalendar_user_preferences cascade;
drop table if exists public.kalendar_bookings        cascade;
drop table if exists public.kalendar_clients         cascade;
drop table if exists public.kalendar_client_notes     cascade;
drop table if exists public.kalendar_bono_purchases   cascade;
drop table if exists public.kalendar_bono_types        cascade;
drop table if exists public.kalendar_patients        cascade;
drop table if exists public.user_roles               cascade;
drop table if exists public.kalendar_team_members    cascade;
drop table if exists public.kalendar_business_hours  cascade;
drop table if exists public.kalendar_services        cascade;
drop table if exists public.kalendar_businesses      cascade;

drop type if exists public.support_ticket_status   cascade;
drop type if exists public.support_ticket_category cascade;
drop type if exists public.booking_status          cascade;

-- ----------------------------------------------------------------------------
-- user_roles
-- A single user (Better Auth "user" table) can hold multiple roles. The role
-- is assigned at the point the user first enters the system through a specific
-- entry point:
--   • signing up / logging in via /login         → 'clinic' role
--   • signing up / logging in via the booking    → 'patient' role
--     page auth gate or /patient/login
-- A user who enters via both paths over time accumulates both roles — they are
-- never in conflict. Route guards (/panel vs /patient) check for the relevant
-- role rather than treating it as a global user type.
-- ----------------------------------------------------------------------------
create table public.user_roles (
  user_id    text        not null references public."user" (id) on delete cascade,
  role       text        not null check (role in ('clinic', 'patient')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles (user_id);

alter table public.user_roles enable row level security;

create policy "UserRoles: write"
  on public.user_roles for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_patients
-- Patient profile linked to an authenticated user. Created the first time a
-- user completes the patient registration flow (booking page auth gate or
-- /patient/login). phone, name, and contact_email are all optional/editable
-- from the patient portal profile page — name/contact_email are deliberately
-- separate from the linked "user" record's Better Auth name/email (same
-- pattern as kalendar_businesses.contact_email), so a patient can present a
-- different display name/contact address without touching their login
-- credentials. Portal falls back to the "user" record's name/email when null.
-- ----------------------------------------------------------------------------
create table public.kalendar_patients (
  id            uuid        primary key default gen_random_uuid(),
  user_id       text        not null unique references public."user" (id) on delete cascade,
  phone         text,
  name          text,
  contact_email text,
  created_at    timestamptz not null default now()
);

create index kalendar_patients_user_id_idx on public.kalendar_patients (user_id);

alter table public.kalendar_patients enable row level security;

create policy "Patients: write"
  on public.kalendar_patients for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_plan_prices
-- List price per plan type. Config table, not hardcoded — editable without a
-- code change. See docs/specs/pricing-and-discounts-spec.md.
-- ----------------------------------------------------------------------------
create table public.kalendar_plan_prices (
  plan_type      text        primary key check (plan_type in ('solo', 'multi')),
  monthly_price  numeric     not null,
  currency       text        not null default 'EUR'
);

insert into public.kalendar_plan_prices (plan_type, monthly_price) values
  ('solo', 49.00),
  ('multi', 69.00);

alter table public.kalendar_plan_prices enable row level security;

create policy "PlanPrices: public read"
  on public.kalendar_plan_prices for select using (true);
create policy "PlanPrices: write"
  on public.kalendar_plan_prices for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_discount_schedule_templates
-- Reusable, named discount schedules (e.g. "Standard Onboarding"). Exactly one
-- row should have is_default = true at a time (app-layer enforced, same
-- pattern as other single-flag invariants in this schema).
-- ----------------------------------------------------------------------------
create table public.kalendar_discount_schedule_templates (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  is_default boolean     not null default false,
  created_at timestamptz not null default now()
);

-- Seed the default onboarding schedule referenced by pricing-and-discounts-spec.md
-- (3mo free -> 6mo 50% -> 6mo 40% -> full price). Phases are inserted after
-- kalendar_discount_schedule_phases exists further below.
insert into public.kalendar_discount_schedule_templates (id, name, is_default) values
  ('00000000-0000-0000-0000-000000000001', 'Standard Onboarding', true);

alter table public.kalendar_discount_schedule_templates enable row level security;

create policy "DiscountTemplates: public read"
  on public.kalendar_discount_schedule_templates for select using (true);
create policy "DiscountTemplates: write"
  on public.kalendar_discount_schedule_templates for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_businesses
-- type/day style values are language-neutral English codes; the UI maps them
-- to localized labels.
-- ----------------------------------------------------------------------------
create table public.kalendar_businesses (
  id                      uuid        primary key default gen_random_uuid(),
  owner_id                text        not null
                                      references public."user" (id) on delete cascade,
  name                    text        not null,
  type                    text        not null check (
    type in (
      'psychology', 'nutrition', 'physiotherapy', 'beauty',
      'fitness', 'coaching', 'tutoring', 'other'
    )
  ),
  -- Legal/tax identifier (NIF/CIF/NIE, etc). Optional for now — format
  -- validation is deferred to the future invoicing feature.
  legal_id                text,
  -- Address (mandatory). Country is implicit (Spain) for now — no country
  -- column until multi-country support is needed. address_street is the
  -- street name only; address_number is the street number; address_additional
  -- covers floor/door/unit (e.g. "5D") and is optional.
  address_street          text        not null,
  address_number          text        not null,
  address_additional      text,
  city                    text        not null,
  address_postal_code     text        not null,
  address_province        text        not null,
  -- Free text, defaults to "España" client-side for new businesses. Not
  -- restricted to Spain in the schema — kept flexible for future expansion.
  address_country         text        not null,
  -- Contact info (mandatory). contact_email is distinct from the owner's
  -- Better Auth account email — this is the client-facing contact address
  -- (defaults to the owner's account email in the UI, but is editable).
  -- Phone is split so the international code (e.g. "+34") and the national
  -- number are stored separately — cleaner for display and future validation
  -- than a single free-text field.
  phone_country_code     text        not null default '+34',
  phone_number            text        not null,
  contact_email           text        not null,
  slug                    text        not null unique,
  -- Slug moderation. Every slug is human-reviewed regardless of the automated
  -- screen at creation. 'active' = publicly bookable; 'pending_review' = held
  -- offline until an admin approves; 'rejected' = suspended, user must repick.
  -- The automated screen at creation sets the initial status: clean slugs go
  -- live ('active') but still await review (slug_reviewed_at is null); slugs
  -- that trip the reserved/profanity screen start 'pending_review'.
  slug_status             text        not null default 'active' check (
    slug_status in ('active', 'pending_review', 'rejected')
  ),
  slug_flag_reason        text,        -- why the auto-screen flagged it; null when clean
  slug_reviewed_at        timestamptz, -- null = awaiting human review (the review queue)
  slug_reviewed_by        text,        -- admin user id who actioned the review; null until reviewed
  brand_color             text        not null default '#0d9488',
  -- Clinic-uploaded logo (business-logos storage bucket, see bottom of this
  -- file). Rendered at a flexible max-height/preserved-aspect-ratio on the
  -- public booking page instead of forcing every clinic's logo into the
  -- fixed square icon slot — many real clinic logos are wide wordmarks
  -- (e.g. "david pueyo fisioterapia y osteopatía"), not square marks, and
  -- squashing those into a square looks broken. Null = fall back to the
  -- default calendar-icon square in brand_color (unchanged from before this
  -- column existed).
  logo_url                text,
  -- Solo vs multi-provider clinic. Controls whether per-member availability/
  -- service rows are materialized (team) or availability is the clinic hours
  -- read directly (solo).
  team_mode               text        not null default 'solo' check (
    team_mode in ('solo', 'team')
  ),
  -- How far ahead clients can book, in months (business-level policy).
  booking_window_months   smallint    not null default 1 check (
    booking_window_months in (1, 2, 3)
  ),
  -- How close to an appointment a patient can still self-cancel immediately
  -- (patient-portal.md's self-service-cancel). Inside this window, self-cancel
  -- is blocked and instead becomes a cancellation *request* requiring owner
  -- approval (calendar-management-upcoming.md's cancellation-request-review —
  -- not yet built as of this column's addition). Bounded to a sane range:
  -- 0 (window disabled, self-cancel always immediate) up to 30 days (720h).
  cancellation_window_hours smallint  not null default 24 check (
    cancellation_window_hours >= 0 and cancellation_window_hours <= 720
  ),
  onboarding_completed_at timestamptz,
  -- ---------------------------------------------------------------------
  -- Demo accounts (workflows/presales-demo-onboarding.md). A demo account is
  -- created through the exact same signup + onboarding flow as a real clinic
  -- (dummy email Arun controls), then flagged after the fact — structurally
  -- identical to a real business row, only these columns distinguish it.
  -- ---------------------------------------------------------------------
  is_demo                 boolean     not null default false,
  demo_created_at         timestamptz,
  -- Source URL of the prospect's public website the demo was researched
  -- from (clinic-prospect-scraper skill output). Null for real accounts.
  demo_source_url         text,
  -- Set on successful migration-execution: the demo's slug gets a "demo-"
  -- prefix applied at that moment, freeing the original slug for the new
  -- real account. Null until migrated.
  demo_migrated_at        timestamptz,
  -- ---------------------------------------------------------------------
  -- Pricing / discount-schedule (see docs/specs/pricing-and-discounts-spec.md).
  -- plan_type drives the kalendar_plan_prices lookup; custom_monthly_price
  -- overrides it per-business when set. discount_start_date is set once at
  -- signup and never edited. If a business has its own rows in
  -- kalendar_discount_schedule_phases (business_id = this row), those take
  -- precedence over discount_template_id — enforced at the write layer, not
  -- the schema, same pattern as other mutually-exclusive-state gates.
  -- ---------------------------------------------------------------------
  plan_type               text        not null default 'solo' check (
    plan_type in ('solo', 'multi')
  ),
  custom_monthly_price    numeric,
  discount_template_id    uuid        references public.kalendar_discount_schedule_templates (id),
  discount_start_date     date        not null default current_date,
  -- ---------------------------------------------------------------------
  -- Stripe subscription linkage (see docs/specs/stripe-subscription-billing-spec.md).
  -- Nullable until the clinic completes its first Checkout session.
  -- subscription_status mirrors Stripe's own status strings 1:1 — do not
  -- invent a parallel vocabulary, so webhook handling stays a pass-through.
  -- ---------------------------------------------------------------------
  stripe_customer_id      text        unique,
  stripe_subscription_id  text        unique,
  subscription_status     text        not null default 'incomplete' check (
    subscription_status in (
      'incomplete', 'trialing', 'active', 'past_due', 'cancelled', 'unpaid'
    )
  ),
  subscription_current_period_end timestamptz,
  created_at              timestamptz not null default now()
);

create index kalendar_businesses_owner_id_idx on public.kalendar_businesses (owner_id);
-- Review queue: rows not yet human-reviewed.
create index kalendar_businesses_review_queue_idx
  on public.kalendar_businesses (slug_reviewed_at)
  where slug_reviewed_at is null;

alter table public.kalendar_businesses enable row level security;

create policy "Businesses: public read"
  on public.kalendar_businesses for select using (true);
create policy "Businesses: write"
  on public.kalendar_businesses for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_presales_codes
-- Single-use codes tied to one demo business (workflows/presales-demo-onboarding.md
-- step: presales-code-generation), letting Arun hand a prospect a code + signup
-- link that migrates the demo into their own real account. Short, human-typeable
-- (Arun sends it directly — sometimes read aloud on a call), not a long opaque
-- token. Only one ACTIVE code per business at a time — app layer revokes any
-- prior active code when a new one is generated for the same business (not a
-- DB constraint, consistent with other business-logic gates in this schema).
-- Default validity is 14 days; a stale/expired code is just regenerated, not
-- extended.
-- ----------------------------------------------------------------------------
create table public.kalendar_presales_codes (
  id             uuid        primary key default gen_random_uuid(),
  business_id    uuid        not null references public.kalendar_businesses (id) on delete cascade,
  code           text        not null unique,
  status         text        not null default 'active' check (
    status in ('active', 'used', 'revoked')
  ),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  used_at        timestamptz,
  -- Set on successful migration signup. No FK — Better Auth's "user" id,
  -- same forward-reference-avoidance rationale as kalendar_bookings.patient_id.
  used_by_user_id text
);

create index kalendar_presales_codes_business_idx on public.kalendar_presales_codes (business_id);
create index kalendar_presales_codes_active_idx
  on public.kalendar_presales_codes (code)
  where status = 'active';

alter table public.kalendar_presales_codes enable row level security;

create policy "Presales codes: write"
  on public.kalendar_presales_codes for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_discount_schedule_phases
-- Ordered phases belonging to a parent — either a reusable template
-- (template_id) or a single business's ad hoc, negotiated schedule
-- (business_id). Exactly one of the two must be set (app-layer enforced,
-- consistent with the patient_id forward-reference precedent in CLAUDE.md —
-- kept as a check constraint here since both parents already exist by this
-- point in the file, so there's no forward-reference problem to work around).
-- After the last phase, discount is implicitly 0% forever.
-- ----------------------------------------------------------------------------
create table public.kalendar_discount_schedule_phases (
  id                uuid        primary key default gen_random_uuid(),
  template_id       uuid        references public.kalendar_discount_schedule_templates (id) on delete cascade,
  business_id       uuid        references public.kalendar_businesses (id) on delete cascade,
  phase_order       integer     not null,
  duration_months   integer     not null,
  discount_percent  numeric     not null check (discount_percent between 0 and 100),
  constraint discount_schedule_phases_one_parent check (
    (template_id is not null and business_id is null) or
    (template_id is null and business_id is not null)
  )
);

create index kalendar_discount_schedule_phases_template_idx
  on public.kalendar_discount_schedule_phases (template_id, phase_order);
create index kalendar_discount_schedule_phases_business_idx
  on public.kalendar_discount_schedule_phases (business_id, phase_order);

alter table public.kalendar_discount_schedule_phases enable row level security;

create policy "DiscountPhases: write"
  on public.kalendar_discount_schedule_phases for all using (true) with check (true);

-- Seed phases for the default "Standard Onboarding" template:
-- 3mo free -> 6mo 50% off -> 6mo 40% off -> full price thereafter.
insert into public.kalendar_discount_schedule_phases
  (template_id, phase_order, duration_months, discount_percent) values
  ('00000000-0000-0000-0000-000000000001', 1, 3, 100),
  ('00000000-0000-0000-0000-000000000001', 2, 6, 50),
  ('00000000-0000-0000-0000-000000000001', 3, 6, 40);

-- ----------------------------------------------------------------------------
-- kalendar_stripe_webhook_events
-- Idempotency ledger for Stripe webhook processing. Stripe explicitly
-- documents that the same event can be delivered more than once — the event
-- ID (evt_...) is checked BEFORE processing and inserted AFTER successful
-- processing, same "write after success" pattern as reminder idempotency.
-- See docs/specs/stripe-subscription-billing-spec.md.
-- ----------------------------------------------------------------------------
create table public.kalendar_stripe_webhook_events (
  id           text        primary key,
  type         text        not null,
  processed_at timestamptz not null default now()
);

alter table public.kalendar_stripe_webhook_events enable row level security;

create policy "StripeWebhookEvents: write"
  on public.kalendar_stripe_webhook_events for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_services
-- ----------------------------------------------------------------------------
create table public.kalendar_services (
  id           uuid           primary key default gen_random_uuid(),
  business_id  uuid           not null references public.kalendar_businesses (id) on delete cascade,
  name         text           not null,
  duration_min integer        not null check (duration_min > 0),
  price        numeric(10, 2) not null default 0 check (price >= 0),
  sort_order   integer        not null default 0,
  created_at   timestamptz    not null default now()
);

create index kalendar_services_business_id_idx on public.kalendar_services (business_id);

alter table public.kalendar_services enable row level security;

create policy "Services: public read"
  on public.kalendar_services for select using (true);
create policy "Services: write"
  on public.kalendar_services for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_business_hours
-- day is a language-neutral English weekday code.
-- ----------------------------------------------------------------------------
create table public.kalendar_business_hours (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.kalendar_businesses (id) on delete cascade,
  day         text        not null check (day in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  -- One row per working interval. A day is "open" if it has >= 1 interval and
  -- "closed" if it has none. Multiple rows per (business, day) enable split
  -- shifts (e.g. 09:00-14:00 and 16:00-20:00). end_time must be after start_time
  -- and intervals on the same day must not overlap (enforced in the app layer).
  start_time  time        not null,
  end_time    time        not null,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index kalendar_business_hours_business_id_idx on public.kalendar_business_hours (business_id);
create index kalendar_business_hours_business_day_idx on public.kalendar_business_hours (business_id, day);

alter table public.kalendar_business_hours enable row level security;

create policy "Hours: public read"
  on public.kalendar_business_hours for select using (true);
create policy "Hours: write"
  on public.kalendar_business_hours for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_team_members
-- ----------------------------------------------------------------------------
create table public.kalendar_team_members (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.kalendar_businesses (id) on delete cascade,
  name        text        not null,
  role        text,
  is_owner    boolean     not null default false,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index kalendar_team_members_business_id_idx on public.kalendar_team_members (business_id);

alter table public.kalendar_team_members enable row level security;

create policy "Team: public read"
  on public.kalendar_team_members for select using (true);
create policy "Team: write"
  on public.kalendar_team_members for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_clients
-- A clinic's own record of a person they've booked, one row per
-- (business, client) — NEVER shared across businesses, even if the same
-- person books with two different clinics on Kalendar. patient_id is an
-- optional soft link to a portal login (kalendar_patients); it carries no
-- special behavior today, just a future hook.
--
-- Guest bookings (public wizard) always create a new row here — no lookup/
-- dedupe by email or phone, by design. Manual bookings (owner, via the panel)
-- search existing rows first via a client picker before falling back to
-- creating a new one.
--
-- total_sessions / completed_count / no_show_count / cancelled_count and
-- first_visit_at / last_visit_at are denormalized counters, deliberately not
-- computed on read (history can grow large). They are updated by the same
-- server action that changes a booking's status/payment (see
-- updateBookingResult in lib/actions/booking-owner.ts) — never by a trigger
-- or cron, so the update logic stays in one visible place.
-- ----------------------------------------------------------------------------
create table public.kalendar_clients (
  id              uuid        primary key default gen_random_uuid(),
  business_id     uuid        not null references public.kalendar_businesses (id) on delete cascade,
  patient_id      uuid        references public.kalendar_patients (id) on delete set null,
  name            text        not null,
  email           text,
  phone           text,
  total_sessions  integer     not null default 0,
  completed_count integer     not null default 0,
  no_show_count   integer     not null default 0,
  cancelled_count integer     not null default 0,
  first_visit_at  timestamptz,
  last_visit_at   timestamptz,
  created_at      timestamptz not null default now()
);

create index kalendar_clients_business_id_idx on public.kalendar_clients (business_id);
create index kalendar_clients_patient_id_idx  on public.kalendar_clients (patient_id) where patient_id is not null;

alter table public.kalendar_clients enable row level security;

create policy "Clients: write"
  on public.kalendar_clients for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_client_notes
-- Private clinic notes about a client (private-clinic-notes,
-- clinic-clients-page.md) — one row per note, timestamped, NOT a single
-- overwritable field on kalendar_clients, so the clinic gets a running
-- history rather than losing what was written before.
--
-- STRICTLY PRIVATE by design: never surfaced to the patient portal, never
-- included in any email, never reachable from a patient-authenticated
-- request — even if the client has a linked kalendar_patients account via
-- kalendar_clients.patient_id, that soft link grants zero note visibility.
-- Notes survive deletion of the linked patient-portal account (on delete
-- set null on kalendar_clients.patient_id already; notes only cascade off
-- kalendar_clients itself, never off kalendar_patients) — this table has no
-- foreign key to kalendar_patients at all, only to kalendar_clients.
--
-- Editable/deletable by the clinic (not append-only) — DECIDED in
-- clinic-clients-page.md; revisit append-only later if a real audit-trail
-- need emerges.
-- ----------------------------------------------------------------------------
create table public.kalendar_client_notes (
  id          uuid        primary key default gen_random_uuid(),
  client_id   uuid        not null references public.kalendar_clients (id) on delete cascade,
  -- Redundant with client_id -> kalendar_clients.business_id, but stored
  -- directly for straightforward RLS/query scoping without a join.
  business_id uuid        not null references public.kalendar_businesses (id) on delete cascade,
  author_id   text        references public."user" (id) on delete set null,
  body        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index kalendar_client_notes_client_id_idx on public.kalendar_client_notes (client_id);

alter table public.kalendar_client_notes enable row level security;

create policy "Client notes: write"
  on public.kalendar_client_notes for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_bono_types
-- Bonos (session-package workflow, bonos.md) — a clinic's configurable
-- catalog of prepaid session bundles (e.g. "Bono 10 sesiones" for a
-- discounted bundle price). Generic sessions, not tied to one specific
-- service, for MVP — matches bono-types-schema-and-config's explicit
-- scoping. Price is entered directly as the bundle total by the clinic, no
-- assumed discount-% math.
-- ----------------------------------------------------------------------------
create table public.kalendar_bono_types (
  id            uuid        primary key default gen_random_uuid(),
  business_id   uuid        not null references public.kalendar_businesses (id) on delete cascade,
  name          text        not null,
  session_count integer     not null check (session_count > 0),
  price         numeric(10,2) not null check (price >= 0),
  -- Retiring a bono type (no longer sold) without deleting it — deleting
  -- would orphan/cascade-delete any kalendar_bono_purchases that reference
  -- it, destroying real sale history. Inactive types just stop appearing
  -- as an option when recording a new sale.
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

create index kalendar_bono_types_business_id_idx on public.kalendar_bono_types (business_id);

alter table public.kalendar_bono_types enable row level security;

create policy "Bono types: write"
  on public.kalendar_bono_types for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_bono_purchases
-- A specific sold bono, tied to a specific client — bono-purchase-recording.
-- No real payment processing (out of scope by design); this just records
-- that a sale happened. sessions_total/price_paid are SNAPSHOTS taken at
-- purchase time, deliberately independent of kalendar_bono_types' own
-- values changing later — same historical-accuracy pattern as invoices
-- snapshotting amount/service_name at invoice time (pdf-invoicing.md).
-- A client can hold multiple concurrent bonos; nothing here prevents that.
-- ----------------------------------------------------------------------------
create table public.kalendar_bono_purchases (
  id             uuid        primary key default gen_random_uuid(),
  business_id    uuid        not null references public.kalendar_businesses (id) on delete cascade,
  client_id      uuid        not null references public.kalendar_clients (id) on delete cascade,
  bono_type_id   uuid        references public.kalendar_bono_types (id) on delete set null,
  sessions_total integer     not null check (sessions_total > 0),
  sessions_used  integer     not null default 0 check (sessions_used >= 0),
  price_paid     numeric(10,2) not null check (price_paid >= 0),
  purchased_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index kalendar_bono_purchases_business_id_idx on public.kalendar_bono_purchases (business_id);
create index kalendar_bono_purchases_client_id_idx   on public.kalendar_bono_purchases (client_id);

alter table public.kalendar_bono_purchases enable row level security;

create policy "Bono purchases: write"
  on public.kalendar_bono_purchases for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_bookings
-- Bookings made on the public /bookings/[slug] page.
--
-- Two booking paths coexist:
--
--   Authenticated patient (patient_id IS NOT NULL):
--     • Booked while signed in as a patient.
--     • Status starts as 'confirmed' immediately — no clinic review needed.
--     • confirm_token is still generated but never emailed.
--     • pending_expiry_at is NULL (no expiry — already confirmed).
--
--   Guest (patient_id IS NULL):
--     • Booked without an account.
--     • Status starts as 'pending_confirmation'.
--     • Clinic has a 24h window (pending_expiry_at = created_at + 24h) to
--       confirm. A cron sweep auto-cancels and emails the guest if ignored.
--     • When the clinic confirms, a confirmation email is sent to the guest.
--     • confirm_token is kept in schema for safety but no longer emailed.
--
-- Service details are SNAPSHOT onto the row so bookings survive service edits.
-- Times are stored as timestamptz (UTC); business timezone is Europe/Madrid.
-- ----------------------------------------------------------------------------
create type public.booking_status as enum (
  'pending_confirmation', 'confirmed', 'cancelled', 'completed', 'no_show'
);

create table public.kalendar_bookings (
  id                   uuid                  primary key default gen_random_uuid(),
  business_id          uuid                  not null references public.kalendar_businesses (id) on delete cascade,
  service_id           uuid                  references public.kalendar_services (id) on delete set null,
  team_member_id       uuid                  references public.kalendar_team_members (id) on delete set null,
  -- Patient who booked (null for guest bookings). FK added below via ALTER TABLE
  -- after kalendar_patients is guaranteed to exist in this same script.
  patient_id           uuid,
  -- The clinic's own client record for whoever this booking is for (see
  -- kalendar_clients above). Nullable: older bookings predate this column.
  -- ON DELETE SET NULL rather than the usual CASCADE — deleting a client
  -- record should not silently wipe their booking history.
  clinic_client_id     uuid                  references public.kalendar_clients (id) on delete set null,
  service_name         text                  not null,
  service_duration_min integer               not null check (service_duration_min > 0),
  service_price        numeric(10, 2)        not null default 0 check (service_price >= 0),
  starts_at            timestamptz           not null,
  ends_at              timestamptz           not null,
  status               public.booking_status not null default 'pending_confirmation',
  -- Independent of status: whether the appointment has been paid. Tracked
  -- manually for now (owner marks it via the past-booking detail modal) —
  -- no payment-processor integration yet.
  payment_status       text                  not null default 'unpaid' check (
    payment_status in ('unpaid', 'paid')
  ),
  client_name          text                  not null,
  client_email         text                  not null,
  client_phone         text,
  -- Optional free-text comment from whoever booked (guest or authenticated
  -- patient), e.g. "First time visiting, please advise on parking." Shown to
  -- the clinic in the calendar/booking detail view and the owner
  -- notification email; never required.
  notes                text,
  -- The UI language the guest/patient was using when they booked.
  -- Drives the language of guest-facing emails and the confirm/cancel pages.
  guest_locale         text                  not null default 'es' check (
    guest_locale in ('es', 'en')
  ),
  -- For guest bookings: clinic must confirm before this timestamp or the booking
  -- is auto-cancelled by the cron sweep. NULL for authenticated-patient bookings
  -- (already confirmed, no expiry needed).
  pending_expiry_at    timestamptz,
  -- Generated for every booking; only used by the legacy token-link flow (guest
  -- bookings pre-auth). Kept for schema continuity but no longer emailed.
  confirm_token        text                  not null unique,
  -- Appointment-reminder tracking (app/api/cron/send-reminders). NULL = not
  -- yet sent; timestamp = sent. Set AFTER a successful send, never before, so
  -- a crash mid-batch leaves the row eligible for retry on the next run
  -- rather than silently skipped. Only 'confirmed' bookings are ever eligible
  -- (re-checked at send time, not just query time, to catch late cancellations).
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at  timestamptz,
  -- Best-effort failure visibility: sendEmail() is silent/best-effort by
  -- design (see lib/email.ts), which is fine for transactional emails but not
  -- for the flagship no-show-reduction feature. Set when a reminder send
  -- throws; surfaced in the panel calendar booking detail
  -- (components/panel/calendar-bookings.tsx). Not cleared automatically —
  -- the next successful send for that same window overwrites/clears it.
  reminder_send_failed boolean               not null default false,
  last_reminder_error  text,
  -- Set when a patient tries to self-cancel inside the clinic's
  -- cancellation_window_hours (kalendar_businesses) — the booking is NOT
  -- cancelled outright; it stays in its current status (slot stays held,
  -- per product decision) and waits for the owner to approve or deny via
  -- the calendar booking-detail modal. NULL = no pending request. Cleared
  -- (set back to null) on either approve (status also becomes 'cancelled')
  -- or deny (status unchanged) — never left set after a decision.
  cancellation_requested_at timestamptz,
  created_at           timestamptz           not null default now(),
  updated_at           timestamptz           not null default now()
);

create index kalendar_bookings_business_id_idx  on public.kalendar_bookings (business_id);
create index kalendar_bookings_patient_id_idx   on public.kalendar_bookings (patient_id) where patient_id is not null;
create index kalendar_bookings_client_id_idx    on public.kalendar_bookings (clinic_client_id) where clinic_client_id is not null;
create index kalendar_bookings_starts_at_idx    on public.kalendar_bookings (starts_at);
create index kalendar_bookings_token_idx        on public.kalendar_bookings (confirm_token);
-- Cron sweep: find expired guest bookings efficiently.
create index kalendar_bookings_expiry_idx       on public.kalendar_bookings (pending_expiry_at)
  where status = 'pending_confirmation' and pending_expiry_at is not null;
-- Reminder cron: find confirmed bookings still owed a 24h and/or 1h reminder.
create index kalendar_bookings_reminder_due_idx on public.kalendar_bookings (starts_at)
  where status = 'confirmed'
    and (reminder_24h_sent_at is null or reminder_1h_sent_at is null);
-- Owner calendar: find pending cancellation requests for a business quickly.
create index kalendar_bookings_cancellation_requested_idx on public.kalendar_bookings (business_id)
  where cancellation_requested_at is not null;

-- NOTE: patient_id intentionally has no FK constraint in this file. The
-- Supabase SQL editor validates all FK references against the live catalog
-- before executing, so a forward reference to kalendar_patients would fail on
-- a fresh database. The app layer enforces the reference integrity: it always
-- resolves patient_id from kalendar_patients.user_id before inserting.

-- Slot-collision guard: at most one active (pending or confirmed) booking per
-- provider+start. A null team_member_id (solo / unassigned) collapses to a
-- single "business chair" via coalesce to the all-zero uuid, so a solo business
-- cannot double-book the same start time. Cancelled/completed rows are excluded
-- so a freed slot can be rebooked.
create unique index kalendar_bookings_active_slot_idx
  on public.kalendar_bookings (
    business_id,
    coalesce(team_member_id, '00000000-0000-0000-0000-000000000000'::uuid),
    starts_at
  )
  where status in ('pending_confirmation', 'confirmed');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger kalendar_bookings_updated_at
  before update on public.kalendar_bookings
  for each row execute function public.set_updated_at();

alter table public.kalendar_bookings enable row level security;

create policy "Bookings: read"
  on public.kalendar_bookings for select using (true);
create policy "Bookings: write"
  on public.kalendar_bookings for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- kalendar_support_tickets
-- Support requests submitted by authenticated users via the panel.
-- The help portal reads and updates this table (status, admin_notes).
-- ----------------------------------------------------------------------------
create type public.support_ticket_status   as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.support_ticket_category as enum ('billing', 'technical', 'feature_request', 'account', 'other');

create table public.kalendar_support_tickets (
  id          uuid                           primary key default gen_random_uuid(),
  user_id     text                           not null
                                             references public."user" (id) on delete cascade,
  user_email  text                           not null default '',
  subject     text                           not null,
  description text                           not null,
  category    public.support_ticket_category not null default 'other',
  status      public.support_ticket_status   not null default 'open',
  attachments text[]                         not null default '{}',
  admin_notes text,
  created_at  timestamptz                    not null default now(),
  updated_at  timestamptz                    not null default now()
);

create index kalendar_support_tickets_user_id_idx on public.kalendar_support_tickets (user_id);
create index kalendar_support_tickets_status_idx  on public.kalendar_support_tickets (status);

create trigger kalendar_support_tickets_updated_at
  before update on public.kalendar_support_tickets
  for each row execute function public.set_updated_at();

alter table public.kalendar_support_tickets enable row level security;

create policy "Support: read"
  on public.kalendar_support_tickets for select using (true);
create policy "Support: insert"
  on public.kalendar_support_tickets for insert with check (true);

-- ============================================================================
-- support-attachments storage bucket
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/gif']
) on conflict (id) do nothing;

-- ============================================================================
-- business-logos storage bucket
-- Clinic-uploaded logos (kalendar_businesses.logo_url), rendered on the
-- public booking page. Public bucket, same pattern as support-attachments
-- above. 2MB limit — logos don't need to be large; keeps upload/render fast.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-logos',
  'business-logos',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- kalendar_user_preferences
-- Per-user app-level preferences that don't belong on Better Auth's own
-- "user" table (which Better Auth owns the shape of). One row per user,
-- created on first save. preferred_name is a soft display name shown in
-- panel greetings — distinct from the account's legal/full name.
-- ----------------------------------------------------------------------------
create table public.kalendar_user_preferences (
  user_id        text        primary key
                              references public."user" (id) on delete cascade,
  preferred_name text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger kalendar_user_preferences_updated_at
  before update on public.kalendar_user_preferences
  for each row execute function public.set_updated_at();

alter table public.kalendar_user_preferences enable row level security;

create policy "User preferences: all"
  on public.kalendar_user_preferences for all using (true) with check (true);

-- ============================================================================
-- End of schema.
-- ============================================================================
