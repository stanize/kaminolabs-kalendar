# Appointment panel: tabbed layout (Cita / Cliente / Historial / Notas)

Reconciled from an uploaded spec (`spec-appointment-panel-tabs.md`, 2026-10-29)
that didn't fully match the current repo — see "Deviations from the uploaded
spec" below for what changed and why. Design settled with Arun across a back-
and-forth; this is the version to build from.

## Goal

Both the appointment side panels — creating a new appointment
(`components/panel/appointment-modal.tsx`, today's simple form) and viewing
an existing one (`components/panel/booking-detail-modal.tsx`, the one with
Caja/No-show/Cancelar/Factura) — grow a 4-tab layout: **Cita / Cliente /
Historial / Notas**. Default tab on open: Cita.

This is a bigger scope than the uploaded spec assumed (it only pictured the
existing-appointment view). Confirmed explicitly with Arun: appointment
*creation* gets tabs too.

## Deviations from the uploaded spec

- **Bonos are NOT being removed.** The uploaded spec listed "Bonos / voucher
  system (being removed)" under non-goals — Arun explicitly rejected this.
  Nothing about bonos changes here. Separately (already built+pushed,
  `4bddd8d`): the client profile's Bonos card is now gated behind
  `bonos_enabled`, matching every other bono entry point — same flag-driven
  show/hide pattern Arun wants applied consistently, not a removal.
- **Tabs 2–4 are NOT built from scratch.** The spec assumed a fresh build
  with a single `notas TEXT` column. In reality `/panel/clients/[id]`
  (`client-detail-view.tsx` + `lib/clients/data.ts` + `lib/actions/clients.ts`)
  already has: editable contact info (name/email/phone/dni/address via
  `updateClientContactInfo`), a proper multi-entry notes system
  (`kalendar_client_notes` — timestamped, individually editable/deletable
  notes via `addClientNote`/`updateClientNote`/`deleteClientNote`), and a
  booking-history query (`getClientDetail`'s `upcoming`/`history`). This
  step reuses all of it rather than duplicating with a weaker single-field
  version.
- **Wrong table name.** The spec guessed `kalendar_patients`/`patients`.
  The right table is **`kalendar_clients`** (via `booking.clinicClientId`).
  `kalendar_patients` is a different table — the patient-portal login
  identity — unrelated to what this feature edits.
- **Importe (editable amount) is OUT OF SCOPE**, reversing the spec's Tab 1
  mockup which showed an editable amount field. Arun, explicitly: the
  appointment's price only ever comes from the service — no per-booking
  override here, and editing it must never write back to the service's own
  price (that's `/panel/services`' job). A per-invoice price/line-item
  override is a *future, separate* feature at invoice-generation time (the
  "preview the invoice, edit certain details" idea) — not this step, not a
  `kalendar_bookings.service_price` edit.
- **"Guest booking has no client" concern — resolved, not a gap.** Verified
  in code: `createBookingAsOwner` and the public `submitBooking` flow
  (`resolveClinicClientId`) already guarantee every booking gets a real
  `kalendar_clients` row by the time it's saved — either a picked existing
  client or a freshly-inserted one (name/email/phone only, no
  dni/address/dob/notes yet). So there's no "disable the tabs" state needed
  for an existing booking — by definition it already has a client. The
  question only mattered for the *creation* flow before a booking exists
  at all (see below).

## Tab 1 — Cita

Already-built payment/cancellation UI (this session), just under a tab
label now — no new logic:
- Service/profesional/fecha/hora fields (existing, in both create and the
  already-built edit-inline fields).
- Pago section: Caja → 7 payment methods (+ bono, flag-gated) → paid
  summary → Generar/Descargar factura. Unchanged by this step.
- Cancelar cita: future = simple confirm, past-unresolved = reason prompt
  (Error de agenda / Otro). Unchanged by this step.
- No Importe field (see deviation above).

## Tab 2 — Cliente

Editable client profile fields, reusing `ContactCard`'s pattern from
`client-detail-view.tsx` (read-only display → "Editar" → fields → "Guardar
cambios" shown/highlighted only when dirty, matching the inline-edit pattern
already built for Cita's own fields):
- Nombre completo, Email, Teléfono, DNI, Domicilio — all already editable
  via `updateClientContactInfo`; extend that action (and the
  `kalendar_clients` row) with one new field:
- **Fecha de nacimiento (NEW)** — `date_of_birth date` on `kalendar_clients`.
  English column name per this repo's English-code convention (CLAUDE.md),
  not the spec's `fecha_nacimiento`.

**Existing booking (BookingDetailModal):** `clinicClientId` already exists
→ fetch+show the real client record immediately, same as Cliente's data
layer (`getClientDetail`, trimmed to just the contact-info portion needed
here, or a lighter dedicated query — avoid over-fetching Historial/notes
twice when Historial/Notas are separate tabs that fetch lazily on
activation).

**New appointment (AppointmentModal, in create mode):**
- Clinic picks an **existing client** via the Cita tab's name search →
  Cliente/Historial/Notas populate immediately with that client's real
  data (we already have a real `clinicClientId` the moment they're picked).
- Clinic types a **brand-new name** (no match picked) → Cliente tab is
  present, not disabled, but empty/editable (no `kalendar_clients` row
  exists yet to load). Historial is empty (nothing to show — not a
  "disabled" state, just genuinely nothing there). Notas is empty.
  Whatever the clinic fills in here (dni/domicilio/fecha de nacimiento,
  and/or a first note — see Tab 4) is held in local component state and
  applied right after the booking (and its new client row) is created —
  `createBookingAsOwner` already creates that row (name/email/phone only);
  this step adds one follow-up write (`updateClientContactInfo`-shaped,
  using the just-created `clinicClientId` from the result) for the staged
  dni/address/fecha_nacimiento/note, mirroring how
  `invoice-on-payment-trigger`'s late client-creation already does a
  create-then-backfill two-step. Never blocks or fails the appointment
  creation itself if this follow-up write fails (reported, not fatal —
  same graceful-degradation convention used everywhere else
  `clinic_client_id`-dependent side effects live).

## Tab 3 — Historial

All appointments for this client, past and future, most recent first.
Reuses `getClientDetail`'s existing `upcoming`+`history` queries (already
scoped by `clinic_client_id`+`business_id`, already carries
status/payment/invoice per row) — merge the two lists and re-sort
descending for this tab's single reverse-chronological view, rather than
writing a third query.

- Past: show payment status (reuses the same `paymentMethodLabel`-style
  summary already built for Tab 1).
- Future: show booking status (confirmada/pendiente).
- Cancelled: grey + strikethrough — reuse `chipClasses()`'s existing
  cancelled/no_show styling from `calendar-grid-view.tsx` rather than a
  new style.
- Current appointment (when viewing an existing booking): highlighted —
  new, small addition (a border/badge keyed on matching booking id).
- Read-only in v1, matching the spec. Empty state: "Este cliente no tiene
  otras citas."
- **New appointment, brand-new client:** empty (see Tab 2 — nothing exists
  yet). **New appointment, existing client picked:** populated immediately,
  same as Tab 2.

## Tab 4 — Notas

Reuses the existing multi-note system as-is (`getClientNotes`,
`addClientNote`, `updateClientNote`, `deleteClientNote`,
`kalendar_client_notes`) — NOT a new single `notas` column. Per Arun:

- Cita tab's own "Comentarios" field (today's single-field
  `booking.notes`, already built into the inline-edit fields) is
  UNCHANGED — stays exactly as is, scoped to that one appointment.
- **New behavior:** whenever that Comentarios field is set/changed (on
  appointment create, or a later Guardar cambios that changes it), the
  same text is ALSO written as a new entry in the client's
  `kalendar_client_notes` list — a one-way mirror at write time, not a
  synced/linked pair. Tag it so it's traceable back to its appointment
  (e.g. a short prefix/label referencing the cita's date, stored as plain
  text in `body` — no new column needed for this, keeps `addClientNote`'s
  signature unchanged). Once mirrored, it's a normal client note — the
  clinic reviews/edits/deletes it from the Notas tab or `/panel/clients/
  [id]` like any other, independently of the booking afterward (no
  continued sync back).
  - Only mirror a NON-EMPTY Comentarios value, and only when it actually
    changed (don't spam a new note on every unrelated field save) —
    compare against the previous value, same dirty-tracking approach
    already used for Guardar cambios.
- **New appointment, brand-new client:** same staging approach as Tab 2 —
  a note typed here (or mirrored from Comentarios) is held locally and
  created via `addClientNote` right after the client row exists.

## Schema change

One new column, additive, non-destructive:

```sql
-- schema_subset_032.sql
-- appointment-panel-tabs: Cliente tab's new Fecha de nacimiento field.
alter table public.kalendar_clients
  add column if not exists date_of_birth date;
```

Folded into `schema_001.sql` too, per this repo's pairing convention. Arun
runs it against the live DB himself, same as every prior subset file.

## Architecture note

This effectively merges `AppointmentModal` (create) and `BookingDetailModal`
(existing-appointment detail) into one tabbed shell with a `mode: "create" |
"edit"` distinction driving what Cliente/Historial/Notas show — not two
separately-maintained tab sets. Both already share the side-panel shell
(this session's earlier work) and a growing amount of field logic
(`lib/booking/appointment-fields.ts`); this step continues that
consolidation rather than building a third parallel structure.

## Status

Status: not_started — design only, verified against the real schema/
components above but no code written yet. Awaiting Arun's go-ahead to
build.
