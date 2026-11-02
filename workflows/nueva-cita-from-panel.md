# "Nueva cita" button on the appointment panel

From a spec Arun brought in: let the clinic start a brand-new appointment
for the same client straight from an existing appointment's side panel,
pre-filled with that client/service/provider — only date/time (and
Comentarios) are left for the clinic to pick.

## Design (resolved against real code before building)

The spec's own open questions, answered by reading the actual
implementation rather than assumed:
- The create form is `components/panel/appointment-modal.tsx`
  (`AppointmentModal`) — already create-only (its old edit mode was
  removed earlier).
- It didn't accept pre-fill props beyond date/time/provider
  (`SlotSelection`) — extended with new optional props instead of a
  parallel component.
- The existing create flow's `onSaved` already triggers a calendar
  refresh (`handleCreated` → `onBookingCreated()` + `router.refresh()`
  in `calendar-grid-view.tsx`) — `BookingDetailModal`'s own `onUpdated()`
  callback does the same job, reused as-is.

## What changed

### `AppointmentModal` (`components/panel/appointment-modal.tsx`)
New optional props: `initialServiceId`, `initialClientId`,
`initialClientName`, `initialClientEmail`, `initialClientPhone` — seed
the existing `serviceId`/`clinicClientId`/`clientName`/`clientEmail`/
`clientPhone` state instead of always starting blank. Provider pre-fill
needed no new prop — `slot.teamMemberId` already covers it.

New `nested?: boolean` prop — when true, uses `z-[65]` instead of the
default `z-50` so it layers correctly on top of `BookingDetailModal`
(itself `z-50`), same stacking idea as the existing Cobrar panel
(`z-[70]`).

### `BookingDetailModal` (`components/panel/booking-detail-modal.tsx`)
- New "+ Nueva cita" button in the panel **header**, next to the client
  name/status badge — chosen over placing it lower in the scrollable
  Cita tab content specifically so it's always visible regardless of
  panel height, per the spec's own "visible without scrolling"
  requirement.
- Clicking it renders a nested `<AppointmentModal nested />` on top,
  built from the current `booking`: `teamMemberId`/service/client all
  pre-filled, date defaults to **today** (Madrid-local, via
  `tzDateParts(new Date())`), time starts **empty** — the closest real
  equivalent to "blank" the existing date/time fields support, forcing
  an actual pick before the form can submit (existing validation
  already requires `timeValid`).
- On save: closes the nested panel and calls `onUpdated()` — the
  original `BookingDetailModal` instance stays open, still showing the
  original appointment, unaffected.
- Reuses everything else for free: double-booking conflict dialog,
  custom-slot suggestions, nearest-slot snap, the two-picker Hora field.

## Scope notes

- No recurring/repeat-appointment concept — out of scope, as the spec
  said.
- Payment info/notes are never copied from the original appointment —
  the new one starts as a completely fresh booking in every way except
  the three pre-filled fields.
- Doesn't touch the public booking page.

## Status

Status: in_progress — code implemented, typechecked/linted/built clean.
Pending Arun's live testing.

Still needs testing (from the spec's own checklist): button visible on
both past and future appointments; client/service/provider pre-filled
and still changeable; date/time genuinely blank/unpicked at open;
creating the appointment works and shows up on the calendar; original
panel stays open and unaffected afterward.
