# Workflow: Clinic Configuration

Business-level rules and parameters that a clinic can configure themselves, beyond the one-time Negocio/Servicios/Equipo/Disponibilidad setup covered in clinic-onboarding.md. Lives conceptually alongside /panel/settings (which today covers language, notifications, security, subscription).

## Step: cancellation-window-setting
Status: not_started
Criteria:
- kalendar_businesses has a configurable column (e.g. cancellation_window_hours) for how close to an appointment a patient can still self-cancel immediately, defaulting to 24
- A settings UI (new tab under /panel/settings, or a section within an existing one — TBD) lets the owner view and change this value
- Change is scoped to the caller's own business, same auth pattern as other business-level settings
- This value is what public-booking's/patient-portal's self-cancel logic reads instead of a hardcoded 24h — see self-service-cancel in patient-portal.md and cancellation-request-review in calendar-management-upcoming.md, both of which currently assume a fixed 24h and need to read this setting once it exists
- Sensible bounds enforced (e.g. can't be negative, probably shouldn't exceed some sane max like a few weeks) — exact bounds TBD

## Notes / Deviations
- This workflow is intentionally scoped to start with just the cancellation window. Other business-level configuration (e.g. booking-window months, which already exists today in Disponibilidad, or a future no-show policy, deposit requirement, etc.) may belong here too as they come up — add as new steps rather than creating parallel workflow files, unless the set grows large enough to warrant splitting.
