# Workflow: Bonos (Session Packages)

Lets a clinic sell prepaid bundles of sessions at a discount (e.g. 10 physio sessions for less than 10x the single-session price) — a common pattern in Spanish clinics/salons. One dedicated page, tabbed: clinic configures the bono types they offer, sells/records a bono purchase against a specific client, and a usage view shows remaining/used sessions per sold bono. Ties into calendar-management-past.md's mark-payment step, since selecting "bono" as a payment method is what triggers automatic session deduction.

## Step: bono-types-schema-and-config
Status: not_started
Criteria:
- New table kalendar_bono_types: id, business_id (FK, cascade), name (e.g. "Bono 10 sesiones"), session_count (integer, > 0), price (numeric, the discounted bundle price), active (boolean, so old bono types can be retired without deleting history), created_at
- "Tipos de bono" tab on the new Bonos page (clinic-configurable, scoped to the caller's business) — create/edit/deactivate bono types, similar in spirit to servicios-setup's catalog management
- Price is entered directly as the bundle total (not auto-calculated from a discount %) — clinic sets whatever price they want, no assumption about the discount math
- Session count is a plain integer — no per-service restriction assumed for MVP (a bono is generic sessions, not tied to one specific service) unless Arun decides that's needed

## Step: bono-purchase-recording
Status: not_started
Criteria:
- New table kalendar_bono_purchases: id, business_id (FK), client_id (FK to kalendar_clients, required — a bono is always tied to a specific client, never anonymous), bono_type_id (FK to kalendar_bono_types), sessions_total (snapshot of session_count at purchase time — independent of the bono type's own value changing later), sessions_used (integer, default 0), price_paid (snapshot of price at purchase time, in case the clinic later changes the bono type's price), purchased_at, created_at
- "Bonos vendidos" tab lets the owner record a sale: pick a client (existing client picker, same as manual-appointment-creation's), pick a bono type, confirm — no real payment processing, this just records that a sale happened (matches the explicit "we don't want any actual payment processing" scoping)
- sessions_total/price_paid are snapshots, not live references to kalendar_bono_types — matches the same historical-accuracy pattern already used in pdf-invoicing.md's kalendar_invoices (amount/service_name snapshotted at invoice time)
- A client can have multiple active (not-yet-fully-used) bonos at once — no restriction against this, since a real clinic client might buy a second bundle before finishing the first

## Step: session-deduction-on-payment
Status: not_started
Criteria:
- Depends on calendar-management-past.md's mark-payment step adding a payment_method field (cash/card/bono)
- When an owner marks a booking as paid with method = "bono", one session is deducted (sessions_used += 1) from the client's bono — scoped to the same client_id as the booking's clinic_client_id
- OPEN QUESTION: if a client has more than one active bono with remaining sessions, which one gets decremented? Options: oldest-purchased-first (matches typical "use it up before it expires" expectation), or the owner is shown a picker to choose which bono to apply it to when marking payment. Needs a decision before building — oldest-first is the simpler default if no strong preference
- If the client has NO active bono with remaining sessions but "bono" is selected as payment method anyway, this needs a clear error/block at the point of marking payment (can't deduct from nothing) rather than silently succeeding or creating a negative-sessions state
- OPEN QUESTION: reversing a payment-method change away from "bono" after the fact — does it restore the deducted session? Not yet decided (also flagged in calendar-management-past.md's mark-payment step). Simplest default: no automatic restoration, correcting a mistake is a manual fix via the Bonos page itself — but confirm this is acceptable before building

## Step: client-page-bono-summary
Status: not_started
Criteria:
- Depends on clinic-clients-page.md's client-detail-view existing
- Client 360 view shows the client's active bonos (bono type name, sessions remaining / sessions total) alongside the existing appointment history and counters
- Fully-used-up bonos are shown too (e.g. in a collapsed/past section) rather than disappearing once exhausted, for the clinic's own reference

## Step: bono-usage-report
Status: not_started
Criteria:
- A view (could be a third tab on the Bonos page, or a filtered view within "Bonos vendidos" rather than a fully separate page) showing all sold bonos across the business — filterable/sortable by remaining sessions (e.g. surface ones close to running out) and by client
- Not scoped as a full analytics/reports page (that's reports-page in post-mvp-menu-items.md, unrelated and still not_started) — this is specifically usage tracking for bonos, nothing broader

## Notes / Deviations
- Page structure decision: one Bonos page with tabs (Tipos de bono / Bonos vendidos, usage folded into the second tab rather than a separate third tab unless it gets busy) — mirrors the existing Clientes/Cancelaciones tab pattern in calendar-bookings.tsx, chosen for consistency rather than introducing a new UI pattern.
- Two open questions block session-deduction-on-payment specifically (which bono to decrement when multiple are active, whether reversing a bono payment restores the session) — resolve both before starting that step, since they shape the mark-payment UI too (a picker adds a step to that modal that a simple oldest-first default wouldn't need).
