# Workflow: Calendar Import (Client Migration)

Lets a clinic switching from another booking tool upload their existing calendar/appointments into Kalendar, rather than starting empty. Entry point lives on the calendar page itself (/panel/calendar), not buried in settings — this is a first-impression feature for a migrating clinic.

## Step: import-format-decision
Status: not_started
Criteria:
- Decide supported input format(s) — ICS (.ics calendar export, near-universal across booking tools and Google/Outlook/Apple Calendar) is the strongest default candidate given how many source systems can export it; CSV as a secondary/fallback option for clinics whose old system only offers a spreadsheet export
- ICS gives structured start/end times and a summary/description field but nothing service- or provider-specific by default — decide how much of that gap CSV vs. ICS realistically closes, or whether manual mapping (see data-mapping-and-review below) is expected to fill it either way

## Step: import-entry-point
Status: not_started
Criteria:
- An "Importar calendario" action is reachable directly from /panel/calendar (e.g. a button near the existing view-mode/nav controls in calendar-header.tsx or calendar-bookings.tsx), not nested inside Settings — consistent with Arun's instruction that this belongs on the calendar page itself
- Opens a dedicated upload flow (modal or its own route) rather than an inline drop zone on the main grid, given the multi-step nature (upload -> map -> review -> confirm) described below

## Step: file-upload-and-parsing
Status: not_started
Criteria:
- File upload accepts the format(s) decided in import-format-decision, with a clear size/row-count limit stated upfront
- Parsing happens server-side (not trusting client-parsed data for anything written to the DB)
- Malformed file / unsupported format produces a clear error before any data is shown, not a silent partial import

## Step: data-mapping-and-review
Status: not_started
Criteria:
- Parsed events are matched against the clinic's own already-configured services and team members (from servicios-setup/equipo-setup in clinic-onboarding.md) — since an imported calendar won't natively contain Kalendar's internal service/provider IDs
- Where a clean automatic match isn't possible (e.g. the old system's event title doesn't map obviously to a configured service), the clinic is shown an editable mapping step before anything is committed — not silently guessed or silently dropped
- A review screen shows a summary (X appointments found, Y auto-mapped, Z needing manual mapping, any date-range covered) before final confirmation — no import commits directly from parse to database without this checkpoint
- Client linking: imported appointments attempt to link to kalendar_clients rows by name/email/phone match where available (same client-linking-on-booking mechanism as clinic-clients-page.md), creating new client rows for unmatched attendees rather than leaving clinic_client_id null across an entire imported history

## Step: import-execution
Status: not_started
Criteria:
- Confirmed import writes bookings scoped to the calling business, respecting the same double-booking/slot-conflict rules as any other booking creation path (partial unique index) — an imported calendar with genuine double-bookings from the old system needs a defined behavior (flag and skip the conflicting ones, not silently overwrite)
- Past imported events land with an appropriate status (likely completed, not confirmed/pending) so they don't show up needing owner review the way a genuine new booking would
- Future imported events land as confirmed (not pending_confirmation) — these are the clinic's own already-agreed appointments, not new guest requests awaiting review
- Import is atomic-ish per batch — a failure partway through doesn't leave a half-imported, hard-to-untangle mess; a way to undo/rollback a specific import batch is worth considering (e.g. tag imported bookings with an import_batch_id) rather than relying on Arun manually cleaning up via schema-reset-tool-style intervention

## Notes / Deviations
- This is a strong complement to presales-demo-onboarding.md — a migrating clinic with an existing calendar is exactly the prospect who benefits most from seeing their real upcoming appointments already populated in a demo, rather than an empty product. Worth cross-referencing when either workflow gets built.
- No decision yet on rate/scale limits (how large a calendar history is reasonable to import) — likely fine to leave unbounded for a solo-founder-scale MVP, revisit if it becomes a real constraint.
