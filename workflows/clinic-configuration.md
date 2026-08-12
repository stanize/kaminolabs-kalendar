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

## Notes / Deviations
- This workflow is intentionally scoped to start with just the cancellation window. Other business-level configuration (e.g. booking-window months, which already exists today in Disponibilidad, or a future no-show policy, deposit requirement, etc.) may belong here too as they come up — add as new steps rather than creating parallel workflow files, unless the set grows large enough to warrant splitting.
