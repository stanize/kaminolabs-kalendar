# UI: side-panel pattern rollout

Arun wants to move the panel's modals from the centered-overlay pattern to
a right-docked side panel (slides in over the main content, leaves the
240px sidebar visible on desktop) — inspired by a competitor tool he
shared a video of. Rolling out component by component, tested live before
moving to the next one.

## Step: appointment-create-panel

Status: in_progress — code implemented and typechecked/linted, pending
live testing.

IMPLEMENTED (2026-10):
- `AppointmentModal` (create + edit shell) converted from a centered modal
  to a right-docked side panel: slides in/out (200ms transform + opacity
  transition), `md:left-[240px]` backdrop inset so the sidebar stays
  visible on desktop, `sm:w-1/2 sm:min-w-[480px]` width (first pass was a
  fixed 440px cap — Arun called it "shy", widened to ~half the screen),
  full-width on mobile (below `sm`).
- Confirmed mobile-compatible: the `md:left-[240px]` offset only applies
  at the sidebar's own breakpoint (sidebar is hidden behind a hamburger
  below `md`), so phones get a full-width sheet.

## Step: booking-detail-panel

Status: in_progress — code implemented and typechecked/linted, pending
live testing.

IMPLEMENTED (2026-10):
- `BookingDetailModal` converted to the same side-panel shell/transition.
  The nested Cobrar and past-cancel-reason pickers stay as small centered
  modals layered on top — quick option pickers, not forms, so the
  side-panel shell doesn't fit them. `invoice-confirm-modal.tsx` not
  converted yet (next candidate).
- **Inline edit merge** (bigger change, same step): Arun asked for
  existing appointments to open directly in edit mode instead of a
  separate "Modificar" step. Decided scope with Arun: fold the editable
  fields (service/profesional/fecha/hora/cliente/notas) directly into
  this panel rather than routing to `AppointmentModal`'s edit mode —
  `AppointmentModal` has no Caja/No-show/invoice actions, so splitting
  the edit surface across two components would've meant duplicating or
  relocating that whole section.
  - `onModify` prop removed; `BookingDetailModal` now takes the same
    `hoursByDay`/`allBookings`/`services`/`members`/`closures`/
    `whatsappEnabled` props `AppointmentModal` already needed, for the
    same conflict/closure-warning checks.
  - Pure helpers/types shared between the two components instead of
    duplicated: `lib/booking/appointment-fields.ts` (`ServiceVM`,
    `MemberVM`, `TimeRangeVM`, `toMinutes`, `ymd`, `hhmmFromIso`,
    `buildSuggestedTimes`). The field-state logic and JSX itself were
    NOT extracted into a shared component — kept duplicated (adapted) in
    each component to avoid touching AppointmentModal's working create
    flow while building this.
  - "Guardar cambios" (reusing `dict.modal.saveButton`'s copy) is always
    visible, styled `primary`/enabled only once something differs from
    the booking's saved values (`isDirty`), `outline`/disabled otherwise
    — not a show/hide toggle, per Arun's "highlight if changes are made".
  - Closing (X or backdrop click) with unsaved changes shows a small
    confirm dialog (`discardTitle`/`discardBody`/`discardStay`/
    `discardConfirm` in `detailModal` dict) instead of silently
    discarding — "Seguir editando" / "Descartar cambios". Every other
    close path (actions that already committed something server-side —
    cancel, no-show, confirm, Cobrar, etc.) is unaffected, goes straight
    through.
  - The future-appointment "Modificar" button and the Conflictos tab's
    standalone "Modificar" shortcut both removed — redundant now that
    opening the panel IS the edit surface. `dict.detailModal.modifyButton`
    and the long-unused `dict.detailModal.saveButton`/`saving` (edit used
    `dict.modal`'s copy instead, which already said "Guardar cambios")
    removed from the dictionary.
  - Client name field is now an editable input, not a link — the
    "Ver perfil del cliente" link (for a `clinicClientId`-linked booking)
    moved to a small link under the field instead.
- **BUG FOUND + FIXED (2026-10-29, Arun, live testing):** the X button and
  backdrop click did nothing — turned out `close` (the helper that calls
  `requestClose(onClose)`) had gotten dropped from an earlier edit,
  leaving `guardedClose()`'s `close()` call silently resolving to the
  browser's own global `window.close()` (a no-op in a normal tab; `close`
  is a real `lib.dom` global so neither tsc nor eslint caught it). Only
  the save-success path worked, since it called `requestClose(onClose)`
  directly. Renamed the helper to `closePanel` to not shadow a global
  again.
- **invoice-generation-now-manual-only (2026-10-29, Arun):** Cobrar no
  longer auto-pops the "¿Quieres generar una factura?" confirm — it just
  records the payment and the panel STAYS OPEN (previously it always
  closed the panel one way or another: existing invoice, auto-invoice
  success, or by opening that confirm modal). Since `booking` is a stale
  prop snapshot from when the panel opened, a `paidOverride` local state
  (`{paymentMethod, paidAt}`, set right after a successful Cobrar) is
  layered over `booking.paymentStatus`/`paymentMethod`/`paidAt` via
  `effective*` values used everywhere the panel previously read the raw
  booking fields for payment display. A "Generar factura" button now
  lives in the Factura section (added to both the future- and
  past-appointment branches, via a shared `invoiceSection` — previously
  that section only existed for past bookings, a pre-existing gap since a
  future prepayment could still auto-trigger the old modal but never
  showed anywhere to view/resend it) once paid and no invoice exists yet;
  clicking it opens `InvoiceConfirmModal` on demand. Full detail in
  `workflows/pdf-invoicing.md` → invoice-on-payment-trigger/
  auto-invoice-setting (now `on_hold`).

Still needs: live-test opening an existing appointment (fields prefilled
correctly, Guardar cambios lights up on an actual change and stays muted
otherwise, save actually updates the booking + grid, conflict/closure
warnings still fire, discard-changes dialog on X/backdrop with unsaved
edits, Conflictos tab row still opens the panel correctly without its old
button, X/backdrop actually closes now), plus the new invoice flow
(Cobrar stays open + shows paid state immediately, Generar factura
button appears and works, future-prepay also gets a Factura section).

## Step: invoice-confirm-panel

Status: in_progress — code implemented and typechecked/linted, pending
live testing.

IMPLEMENTED (2026-10-29, Arun):
- `InvoiceConfirmModal` converted to the same side-panel shell (it's
  reused by 3 entry points — the Factura section's "Generar factura"
  button, Facturas > Pendientes, and a client's own booking history — all
  three pick this up automatically, same `onClose`/`onDone` props).
- Title changed from the question "¿Quieres generar una factura?" to a
  plain "Factura" header, with a standard X close button — matching
  every other panel now instead of being the one modal phrased as a
  yes/no question. The bottom "No" button is gone; the X/backdrop is the
  decline path (both still call `onClose`, same as before, just no
  longer via the "No" button specifically). `dict.no` removed as unused.
- The "Generar factura" button in BookingDetailModal's Factura section
  restyled from `outline`/`sm` to `primary` (default size) — same visual
  weight as the Caja button rather than reading as a secondary action.

Still needs: live-test (panel slides in from the right over the Factura
section, X/backdrop closes without generating, DNI/Domicilio/concept
flow unchanged, success closes the panel and the Factura section updates
to show Descargar/Reenviar — verify this from all 3 entry points, not
just Cobrar).

## Not yet converted

- `availability-manager.tsx`'s edit-hours modal, `payment-method-modal.tsx`,
  `subscribe-modal.tsx` — candidates, same side-panel shell.
- `closure-conflict-dialog.tsx`, `booking-page-card.tsx`, `save-overlay.tsx`
  — deliberately staying centered modals (small confirm/preview dialogs,
  not forms).
- `email-verification-gate.tsx`, `role-upgrade-gate.tsx` — not applicable,
  full-screen blocking gates, not dismissible dialogs.
