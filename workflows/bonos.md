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
- Depends on calendar-management-past.md's mark-payment step adding a payment_method field (cash/card/bono, plus which specific bono if applicable — see UI behavior below)
- DECIDED — payment method selector UI: only appears once the owner sets a booking's status to paid, not shown at all beforehand (opens inline next to the paid toggle, not a separate step). Options are Cash, Card, and — if the client (via the booking's clinic_client_id) has one or more active bonos with sessions remaining — one distinct option per bono (not a single generic "Bono" entry), labeled so the clinic can tell them apart (e.g. bono type name + remaining count, "Bono 10 sesiones (3 restantes)"). If the client has no active bono, only Cash/Card show — no bono option appears at all.
- DECIDED — default selection: if the client has at least one active bono, the OLDEST one (earliest purchased_at) is pre-selected in the dropdown by default. The clinic can override and pick Cash, Card, or a different bono instead — nothing is silently auto-applied without the dropdown being visible and editable.
- Confirming payment with a bono option selected deducts one session (sessions_used += 1) from that specific bono row — scoped correctly regardless of whether it was the defaulted oldest one or a manually-chosen different one
- If a client has NO active bono with remaining sessions, the bono option(s) simply don't appear in the dropdown (per the UI behavior above) — this naturally prevents the "selected bono but none exist" error case from the earlier draft of this step, no separate validation/error state needed
- DECIDED — payment-method correction after the fact, lock is ONE-DIRECTIONAL: switching INTO a bono (from cash, from card, or picking a bono for the first time) is always allowed from the booking detail modal, anytime — this triggers the normal deduction per session-deduction-on-payment above, no restriction on when it happens relative to when the booking occurred. Switching AWAY from a bono (bono -> cash, bono -> card) is what LOCKS in this modal — the clinic cannot do that switch here. Attempting to shows a message directing them to the Bonos page instead. This keeps bono-balance-reducing reversal logic in exactly one place (the Bonos page, see bono-session-reversal below) while still allowing the balance-consuming direction freely, since consuming a session is straightforward but reversing one needs the fuller context (which specific usage record) that only the Bonos page's per-bono history naturally provides.

## Step: bono-session-reversal
Status: not_started
Criteria:
- Depends on bono-purchase-recording (the bono itself) and session-deduction-on-payment (the thing being reversed)
- On the Bonos page, opening a specific sold bono (from "Bonos vendidos") shows its usage history — each session consumed, linked back to the booking it came from
- From this usage history, the clinic can select a specific used session and switch it to cash or card — this is the ONLY place a bono-consumed session can be reversed (the booking detail modal only locks the bono-to-cash/card direction, per mark-payment's UI behavior; cash/card-to-bono remains freely available there)
- Switching a used session away from a bono: restores the session to the bono (sessions_used -= 1) AND updates the linked booking's payment_method to the chosen cash/card value — both happen atomically, not as two separate edits that could get out of sync

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
- Both design questions from earlier drafts of this workflow are now RESOLVED: which bono to decrement defaults to oldest with clinic override (session-deduction-on-payment), and the payment-method lock is one-directional — switching INTO a bono (from cash/card, anytime, retroactively too) is always allowed in the booking detail modal; switching AWAY from a bono is what's locked there, and only happens via the Bonos page's per-bono usage history (bono-session-reversal). This workflow's design is now considered fully settled and ready to build against.
