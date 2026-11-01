# Team member lifecycle — delete vs. disable (Equipo)

From Arun: the Equipo page shouldn't batch edits behind a "Guardar
cambios" button — every action should commit immediately. Also: a team
member should only be hard-deletable if they have zero bookings, ever
(past or future). The moment a booking references them, deletion must be
blocked — instead the member is **disabled**: functionally equivalent to
deletion (can't be assigned to new bookings, in the clinic calendar or the
public booking page) but kept in all historical records (past bookings,
invoices) so nothing breaks retroactively.

## Decisions (confirmed with Arun before building)

- A disabled member stays **visible** in the Equipo list, grayed out, with
  a "Desactivado" badge — not hidden.
- Disabling is **reversible** — a "Reactivar" action flips them back to
  bookable.
- Every Equipo action commits immediately as its own server call: mode
  switch, add, edit, delete-or-disable, reactivate, and drag-reorder (on
  drop). Delete specifically requires an inline confirm step first (same
  row-level confirm pattern as Vacaciones), not a silent instant delete.

## Data model

`kalendar_team_members.active boolean not null default true`
(`schema_subset_035.sql`, folded into `schema_001.sql`). No RLS/FK changes
— existing `ON DELETE CASCADE`/`ON DELETE SET NULL` behavior from bookings
is untouched; disabling never deletes a row, so none of that fires.

## Server actions (`lib/actions/team.ts`)

Replaced the old single `saveTeam` (whole-roster batch commit) with
granular, immediately-committing actions:
- `setTeamMode` — solo/team switch; solo still requires no other members
  (active or disabled) in the roster, same rule as before.
- `createTeamMember` / `updateTeamMember` — single-member insert/update.
- `deleteOrDisableTeamMember` — counts `kalendar_bookings` rows for that
  `team_member_id` (any status, any time — a single ever-existing booking
  is enough). Zero → hard delete. One or more → sets `active = false`
  instead and returns the updated member so the UI can show it disabled.
  Owner is never deletable (existing rule, unchanged).
- `reactivateTeamMember` — `active = true`.
- `reorderTeamMembers` — takes the full ordered id list, sets
  `sort_order` per index; fired on every drag-drop instead of waiting for
  a batch save.

## UI (`components/panel/team-manager.tsx`)

- No more bottom "Guardar cambios" — removed entirely.
- Member rows: compact list (icon, name, role). Editar opens the existing
  side panel (Nombre/Rol/DNI/Nº colegiado) which now calls
  `createTeamMember`/`updateTeamMember` directly instead of only touching
  local state.
- Eliminar on an active member shows the same inline row-level confirm
  pattern used on Vacaciones ("¿Eliminar?" / Eliminar / Cancelar) before
  calling `deleteOrDisableTeamMember`. If the result disables instead of
  deletes, the row updates in place (grayed, "Desactivado" badge,
  Reactivar button) — no separate error or dialog, since disabling isn't a
  failure, it's the expected outcome once bookings exist.
- A disabled row has no Editar/Eliminar — just "Reactivar".

## New-booking provider pickers exclude disabled members

- Public booking page (`lib/booking/data.ts`'s `getPublicBookingData`):
  the `kalendar_team_members` query now filters `.eq("active", true)` —
  disabled providers never appear in the public step-picker, and
  `createBooking`'s existing `data.members.some(...)` validation (already
  there, unrelated to this change) now also rejects a forged/stale
  providerId for a disabled member as a side effect of the same filter.
- Clinic calendar (`components/panel/calendar-grid-view.tsx`'s
  `AppointmentModal` — create-only): `members` prop now filters
  `allMembers.filter(m => m.active)` before mapping — the "+ cita" picker
  only offers active providers.
- Explicitly **NOT** filtered: `BookingDetailModal` (editing an existing
  booking) still receives the full member list including disabled ones,
  so a booking already assigned to a since-disabled provider keeps
  editing other fields without losing that assignment, and the week-grid
  columns (`WeekMemberVM`) still show a disabled provider's column so
  their past/existing bookings remain visible. `WeekViewMember`/
  `WeekMemberVM`/`MemberVM` all carry the new `active` field end-to-end so
  any future call site can filter the same way.

## Status

Status: in_progress — code implemented, typechecked/linted/built clean.
Pending Arun's live testing + running `schema_subset_035.sql` against the
live DB (via the admin Run-migrations tool).

Still needs testing: mode switch/add/edit/reorder all commit immediately
with no page-level save step; deleting a member with zero bookings
removes them outright; deleting a member with any booking disables them
instead (grayed row + badge + Reactivar); a disabled provider doesn't
appear in the public booking page's provider step or the clinic
calendar's "+ cita" picker, but their existing bookings/history/invoices
are unaffected and still display correctly.
