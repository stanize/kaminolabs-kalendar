# Spec: Plan Pricing & Discount Schedules

**Status:** Not yet built. This is a design spec to build from, not a build
log. Addresses backlog item "no plan/tier enforcement" (flagged in
`docs/reviews/2026-07-18-review.md`, gap #3 / recommended-next-3 #2).

**Scope of this spec:** the internal pricing/entitlement model only.
Actual payment collection (Stripe or similar) is explicitly out of scope and
will be wired in later against this same schema — do not couple this build
to a payment provider.

---

## 1. Goals

- One list price per plan type (`solo` / `multi`), editable without a
  code change.
- A **default discount schedule** applied to every new signup: 3 months
  free → 6 months at 50% → 6 months at 40% → full price thereafter. The
  phase count, durations, and percentages must be data, not hardcoded, so
  they can be changed in the admin portal at any time and apply to future
  signups without a deploy.
- Support **ad hoc, per-business overrides** for negotiated deals — both
  a custom discount schedule and/or a custom monthly price — independent
  of each other.
- No cron-computed/stored price. The current discount and price are
  **always derived on read** from `start_date` + today's date + the
  phase table, so they can never drift out of sync.
- A daily cron only to **detect phase-boundary crossings** and notify the
  business by email that their price is about to change. It does not
  compute or store pricing.

---

## 2. Schema

### `kalendar_plan_prices`
List price per plan type. Config table, not hardcoded.

| column | type | notes |
|---|---|---|
| plan_type | text (`solo` \| `multi`) | PK |
| monthly_price | numeric | |
| currency | text | default `EUR` |

### `kalendar_discount_schedule_templates`
Reusable, named templates (e.g. "Standard Onboarding"). One should be
flagged as the default applied at signup.

| column | type | notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Standard Onboarding" |
| is_default | boolean | exactly one row should be true at a time |
| created_at | timestamptz | |

### `kalendar_discount_schedule_phases`
Ordered phases belonging to a template. Same shape is reused for
business-owned ad hoc schedules (see below) — one phases table, two
possible parents.

| column | type | notes |
|---|---|---|
| id | uuid | PK |
| template_id | uuid, nullable | FK → `kalendar_discount_schedule_templates`, `ON DELETE CASCADE` |
| business_id | uuid, nullable | FK → business table, `ON DELETE CASCADE` — set instead of `template_id` for ad hoc, business-owned phases |
| phase_order | integer | 1-indexed, ordering within the parent |
| duration_months | integer | length of this phase |
| discount_percent | numeric | 0–100 |

Constraint: exactly one of `template_id` / `business_id` must be set
(check constraint or app-layer enforcement, consistent with how the repo
already handles similar "forward reference" FK cases — see `patient_id`
precedent in `CLAUDE.md`).

After the last defined phase, discount is implicitly 0% (full price)
forever — no need for an explicit terminal phase row.

### Business row additions (on the existing business/clinic table)

| column | type | notes |
|---|---|---|
| plan_type | text (`solo` \| `multi`) | drives list-price lookup |
| custom_monthly_price | numeric, nullable | overrides `kalendar_plan_prices` lookup if set |
| discount_template_id | uuid, nullable | FK → `kalendar_discount_schedule_templates`; null if using business-owned ad hoc phases instead |
| discount_start_date | date | set once at signup, never edited |

If a business has phase rows in `kalendar_discount_schedule_phases` with
`business_id` matching them, those take precedence over
`discount_template_id`. (Only one of the two should be populated in
practice — enforce at the admin-portal write layer, same pattern as other
mutually-exclusive-state gates elsewhere in the app.)

---

## 3. Computation logic (pure function, no DB writes)

Given a business's `discount_start_date`, `plan_type`,
`custom_monthly_price`, and its resolved phase list (business-owned phases
if present, else the referenced template's phases, ordered by
`phase_order`):

```
function currentDiscountPercent(startDate, phases, today):
    monthsElapsed = wholeMonthsBetween(startDate, today)
    cursor = 0
    for phase in phases (ordered):
        if monthsElapsed < cursor + phase.duration_months:
            return phase.discount_percent
        cursor += phase.duration_months
    return 0  # exhausted all phases -> full price

function currentPrice(business, today):
    listPrice = business.custom_monthly_price ?? kalendar_plan_prices[business.plan_type]
    discountPct = currentDiscountPercent(business.discount_start_date, resolvedPhases(business), today)
    return listPrice * (1 - discountPct / 100)
```

This function is called wherever a price needs to be displayed or (later)
charged. Nothing about the discount is ever written back to the business
row — it's recomputed every time from `discount_start_date` and the phase
table.

---

## 4. Worked examples

**Standard signup, no overrides:**
Clinic signs up March 1 as `solo` (€49/mo), assigned the default template
(3mo/100%, 6mo/50%, 6mo/40%). On June 15 (month 3.5 elapsed) the function
walks into phase 2 → 50% off → €24.50 that month. On Dec 1 (month 9) it
lands in phase 3 → 40% off, automatically, with no job having "updated"
anything.

**Ad hoc discount schedule override ("Fisio Sur"):**
Negotiated 12 months free instead of 3. `discount_template_id` stays
null; instead, rows are inserted into `kalendar_discount_schedule_phases`
with `business_id = Fisio Sur`: phase 1 (12mo, 100%), phase 2 (6mo, 50%),
phase 3 (forever, 40%). Same `currentDiscountPercent` function runs
unchanged — it just resolves a different phase list for this business.

**Ad hoc price override ("Clínica Norte"):**
Negotiated €55/mo instead of the standard €69 `multi` price, but on the
normal default discount schedule. `custom_monthly_price = 55.00` is set;
`discount_template_id` stays pointed at "Standard Onboarding". The two
overrides (price vs. schedule) are fully independent and can be combined
or used individually.

---

## 5. Cron job scope (notification only)

Runs daily. For each active business, compares yesterday's
`currentDiscountPercent` to today's. If they differ, the business has
just crossed a phase boundary — send an email: *"Your subscription price
is changing starting today: [old] → [new]. Contact support with
questions."* This is the entire responsibility of the cron — it does not
compute, store, or mutate any pricing data. (Consistent with the existing
convention in this repo — see the reminders cron for the pattern of a
scheduled job that reads current state and sends a notification without
mutating pricing/business data.)

---

## 6. Admin portal surface (not yet designed in detail — flag for a

dedicated design pass before building)

- CRUD for discount schedule templates (name, ordered phases,
  default flag).
- Per-business detail page: set `plan_type`, optional
  `custom_monthly_price`, and either select a template or define ad hoc
  phases for that business.
- Read-only display of the business's currently computed price/discount
  (using the same shared function above, never a separately stored
  value).

---

## 7. Explicit non-goals for this build

- No Stripe/payment-provider integration.
- No multi-tier feature matrix beyond `solo` / `multi` seat-count gating.
- No campaign/promo-code system (tracked separately, deferred by Arun's
  own decision — see conversation this spec originated from).
- No automatic `plan_type` derivation from team size — stays a manually
  set field on the business row for now.
