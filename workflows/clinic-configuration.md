# Workflow: Clinic Configuration

Business-level rules and parameters that a clinic can configure themselves, beyond the one-time Negocio/Servicios/Equipo/Disponibilidad setup covered in clinic-onboarding.md. Lives conceptually alongside /panel/settings (which today covers language, notifications, security, subscription).

## Step: cancellation-window-setting
Status: done
Criteria:
- kalendar_businesses has cancellation_window_hours (smallint, default 24, CHECK 0–720)
- Settings UI exists as a dedicated "Reservas" tab (/panel/settings/bookings, CancellationWindowForm) — preset options (0/12/24/48/72h) plus free-entry custom value, mirroring the existing booking_window_months pattern
- updateCancellationWindow is scoped to the caller's own business, same auth pattern as other business-level settings
- self-service-cancel (patient-portal.md) and cancellation-request-review (calendar-management-upcoming.md) both read this value instead of a hardcoded 24h
- Bounds enforced both client-side (form validation, 0–720 with a clear Spanish error message) and at the DB level (CHECK constraint)

## Step: bonos-visibility-toggle
Status: not_started
Criteria:
- SPEC (2026-10-07, Arun): `kalendar_businesses` gains `bonos_enabled` (boolean, NOT NULL, default `false`). Purely a visibility flag — no change to bonos logic itself (bonos.md's schema/actions/triggers are untouched).
- Toggle lives on the **Servicios** page (not /panel/settings — matches this file's existing pattern of config living alongside the feature it governs, see cancellation-window-setting's own "Reservas" tab precedent), labeled **"Activar bonos"**, off by default.
- When `bonos_enabled` is false:
  - The Bonos tab/section is hidden entirely from the clinic panel's sidebar nav (no empty-state page reachable via direct URL either — route-guard it the same way other feature gates in this app redirect/404 rather than just hiding the nav link).
  - The bono option(s) in the mark-payment payment-method selector (calendar-management-past.md) do not appear, even if the client has active bonos from before the flag was turned off — see cross-reference note in that file's `cobrar-button-and-paid-at` step.
- When `bonos_enabled` is true, bonos work exactly as already specified in bonos.md — no behavior change, just unhidden.
- DECIDED (2026-10-07, Arun): turning the flag back off after bonos have already been sold does NOT hide or break historical data — past appointments already paid with a bono continue to display their bono payment method/history normally (booking detail modal, client-page-bono-summary, Clientes/past-appointment views). Only the Bonos tab/section itself and the forward-looking bono option in the payment-method selector are gated by the flag; nothing already written to `kalendar_bono_purchases`/`kalendar_bookings` is affected.
- Rationale (Arun): health professionals who don't sell session packages (podólogos, sanitarias, etc.) shouldn't see bonos at all unless they explicitly opt in — reduces clutter/confusion for the majority who won't use this feature.
- OPEN QUESTION: whether the patient portal's "Mis bonos" section (bonos.md's patient-bono-view) should also hide when the owning clinic has `bonos_enabled = false`, or keep showing a patient's own historical bonos regardless of the clinic's current flag state (same "history stays visible" principle as the clinic side, applied from the patient's perspective). Leaning toward "show if the patient has any bonos at that clinic, regardless of the clinic's current flag" for consistency with the decision above, but not yet confirmed with Arun — flag before building.

## Notes / Deviations
- This workflow is intentionally scoped to start with just the cancellation window. Other business-level configuration (e.g. booking-window months, which already exists today in Disponibilidad, or a future no-show policy, deposit requirement, etc.) may belong here too as they come up — add as new steps rather than creating parallel workflow files, unless the set grows large enough to warrant splitting.
- `bonos-visibility-toggle` (2026-10-07) is cross-referenced from bonos.md and calendar-management-past.md — update all three together if this design changes.
