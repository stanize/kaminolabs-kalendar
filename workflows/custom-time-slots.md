# Custom time slots (Disponibilidad)

From Bea's feedback: replace the generic hourly interval picker with her
clinic's exact fixed appointment times (`9:45 / 10:30 / 11:15 / 12:00 /
...`). Arun explicitly ruled out touching Horarios/Disponibilidad's
existing business-hours model — this is a new, additive, opt-in layer on
top of it, not a change to it. Design settled across several
back-and-forth turns with Arun; this is the final version to build from.

## Where it lives

A new 4th tab on the Disponibilidad section, in this order:
**Horarios → Horarios personalizados → Festivos → Vacaciones**
(`/panel/availability`, `/panel/availability/custom-slots`,
`/panel/availability/holidays`, `/panel/availability/time-off`) — added to
`AvailabilityTabs`' `TABS` array and `AvailabilityLayout`'s page shell,
same as the existing three.

Not on the Equipo page (an earlier framing, corrected once Arun clarified
this is a scheduling/Disponibilidad concept, not a team-roster one).

## Data model — its own rule table, not reusing Festivos/Vacaciones' shape

Neither existing closures table fits this directly: `kalendar_business_
closures` (Festivos) is clinic-wide only (no team_member_id concept at
all in that UI), `time-off` rows are always scoped to exactly one
provider. Horarios personalizados needs a THIRD, more flexible scope per
rule — confirmed explicitly by Arun: **all providers, some providers
(a real multi-select), or one provider** — so `team_member_id` (a single
nullable FK, the closures/time-off pattern) doesn't fit; this needs an
array.

```sql
-- schema_subset_034.sql
create table if not exists public.kalendar_custom_time_slots (
  id              uuid        primary key default gen_random_uuid(),
  business_id     uuid        not null references public.kalendar_businesses (id) on delete cascade,
  label           text,                          -- clinic's own reference name, optional
  -- empty/null = every day the business is open; non-empty = only these weekdays
  days            text[]      not null default '{}',
  -- empty/null = all providers; non-empty = this specific set (1 or more)
  team_member_ids uuid[]      not null default '{}',
  -- the slot list itself, "HH:MM" strings, clinic-entered order preserved
  -- (not auto-sorted — matches how they'll naturally type them in order)
  times           text[]      not null default '{}',
  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now()
);
```

`days` values are the same `DayId` codes everywhere else in this repo
(`mon`/`tue`/.../`sun`) — plain text, not a DB enum, matching
`kalendar_business_hours.day` and every other weekday column in this
schema. No FK on `team_member_ids` (Postgres arrays can't FK) — validated
app-side against the caller's own `kalendar_team_members` on write, same
general pattern as other array/jsonb fields in this codebase that can't
be FK-constrained.

## Resolution: which slots show for a given (date, provider)

For the appointment form's time-suggestion dropdown (both
`AppointmentModal` create and `BookingDetailModal`'s inline Cita-tab
edit — same `buildSuggestedTimes` call site in
`lib/booking/appointment-fields.ts`, needs a new sibling function):

1. Find every `kalendar_custom_time_slots` row where
   (`days` is empty OR contains the selected date's weekday) AND
   (`team_member_ids` is empty OR contains the selected `teamMemberId`).
2. If one or more rules match: union their `times` (dedupe, no need to
   sort — display in the union's natural order, times are short lists)
   and use that as `suggestedTimes` **instead of** the generic
   hourly-from-business-hours list.
3. If no rule matches: fall through to today's existing hourly
   suggestion behavior, completely unchanged — a provider/day with no
   custom rule behaves exactly as it does right now.

Everything downstream of `suggestedTimes` is untouched: the time field
still accepts any free-typed value (in or out of the list), `isTimeTaken`
conflict-checking is unaffected, the past-cancel/Cobrar/etc. flows don't
know or care where the suggestion list came from.

## Out-of-hours highlighting (non-blocking, both directions)

Per Arun: "if custom slots fall out of business hours, highlight them for
the clinic to confirm and override" — never blocked, matching this
codebase's existing closure/outside-hours convention everywhere else
(`isOutsideHours` today is a soft note, never disables submission).

- **While defining a rule** (the side panel below): for each day the rule
  applies to (or every open day, if "all days"), check each entered time
  against that day's actual `kalendar_business_hours` ranges. A time
  outside hours for ANY of its applicable days gets a visual flag (e.g.
  amber dot/border) right in the rule editor's slot-list, so the clinic
  sees it before saving — not an error, just a heads-up.
- **In the booking form's own time dropdown**: the same per-slot check
  runs again for the actual selected date, so a slot that's fine on
  Tuesdays but outside Thursday's shorter hours shows correctly flagged
  depending on which date is actually selected that moment.

## UI — side-panel pattern throughout, consistent with this session's rollout

- `/panel/availability/custom-slots` page: a plain list of existing rules
  (label or a generated summary like "Lun, Mié, Vie · Todos los
  profesionales · 4 horarios"), each with Editar/Eliminar, plus an
  "Añadir horario personalizado" button.
- Both Añadir and Editar open the SAME right-docked side panel (same
  shell as `AppointmentModal`/`BookingDetailModal`/
  `InvoiceConfirmModal` — `md:left-[240px]` backdrop inset, slide
  in/out, `sm:w-1/2 sm:min-w-[480px]`), containing:
  - Label input (optional).
  - Days: "Todos los días" toggle, or a weekday multi-select (chips,
    `mon`..`sun`) when toggled off.
  - Providers: "Todos los profesionales" toggle, or a multi-select list
    of the business's `kalendar_team_members` when toggled off (checkbox
    list, not a dropdown — matches "some providers" needing to be
    genuinely easy to multi-pick).
  - Times: an add/remove list of `HH:MM` inputs (same small-list-editor
    feel as the invoice-concepts list elsewhere in this app), each
    flagged inline if it falls outside the applicable days' business
    hours per the section above.
  - Guardar / Cancelar, mirroring every other panel's footer.

## Scope notes / what this does NOT touch

- `kalendar_business_hours` (Horarios) and its existing UI: completely
  untouched — this is a parallel, optional layer, not a replacement.
  A provider/day with no matching custom rule works exactly as today.
- Festivos and Vacaciones: data model/scoping untouched (all-only /
  one-only stays exactly as is) — but see below, their UI shell IS
  changing as part of this same pass.

## Festivos + Vacaciones — also moved to the side-panel pattern

Arun: "also factor in side panel patterns for festivos and vacations."
Verified both pages' current shell: `FestivosManager` and `TimeOffList`
have NO popup/modal today — add and edit are both inline, expand-in-
place forms on the page itself (`showAddForm`/`editingId` toggles).
Converting that to the panel pattern:

- Both pages' "Añadir" button and each row's "Editar" open the same
  right-docked side panel shell (as above), with the same fields the
  inline form has today — nothing about what's editable changes, only
  the shell. Festivos: month/day (or date range) + label. Vacaciones:
  provider + date range + label.
- `ClosureConflictDialog` (the shared existing-bookings-conflict warning
  both pages can trigger on save) STAYS a small centered modal, not a
  side panel — same classification as Cobrar/past-cancel/discard-changes
  elsewhere in this app: a quick preview-and-confirm dialog, not a form,
  so the side-panel shell doesn't fit it. It currently layers on top of
  the inline form; once that form is a side panel, this dialog simply
  layers on top of the panel instead (same z-index relationship as
  Cobrar-on-top-of-BookingDetailModal already established).

## Status

Status: not_started — design only, verified against the real schema/
components above (AvailabilityTabs, buildSuggestedTimes, the closures/
time-off precedents) but no code written yet. Awaiting Arun's go-ahead
to build.
