# Workflow: Post-MVP Menu Items

Sidebar nav links (components/panel/sidebar.tsx) that exist today but have no real page behind them, or only a placeholder. Tracked here as a single collection rather than one file per item, since the immediate need is visibility for a nav cleanup pass, not detailed specs — promote any of these to their own workflow file once real design work starts on it.

## Step: nav-audit
Status: done
Criteria:
- Every sidebar.tsx NAV_ITEMS route checked against app/panel/ for a real page vs. missing vs. placeholder-only
- Result: /panel — real (panel home). /panel/calendar — real. /panel/clients — MISSING, tracked separately in clinic-clients-page.md, not here (it's an MVP priority, not post-MVP). /panel/business — real. /panel/services — real. /panel/team — real. /panel/availability — real. /panel/settings — real. /panel/support — real.
- Remaining items below are the actual post-MVP list: nav links pointing at either a missing route or a placeholder-only page

## Step: payments-page
Status: not_started
Criteria:
- REMOVED FROM NAV: no longer linked in the sidebar (commit ce5f610), but the route/page itself still exists at /app/panel/payments/page.tsx, unreachable via nav but not deleted — differs from invoices/notifications/reports/integrations below, which were deleted outright
- /app/panel/payments/page.tsx exists but is explicitly a placeholder — its own code comment confirms this
- Intended scope per that comment: payments FROM the clinic's own clients (deposits, no-show charges, per-appointment payment status) — NOT the Kalendar SaaS subscription (that's /panel/settings/subscription, already built)
- kalendar_bookings.payment_status already exists in schema for this future build-out (paid/unpaid, set via updateBookingResult — see calendar-management-past.md's mark-payment step, which already covers the per-booking toggle)
- Not yet decided what this page adds beyond what mark-payment already covers — possibly a clinic-wide payments ledger/report view rather than new per-booking functionality
- Confirm with Arun whether leaving the now-orphaned page.tsx in place (vs. deleting it like the other four) was intentional, or just missed in the cleanup pass

## Step: invoices-page
Status: not_started
Criteria:
- REMOVED (commit ce5f610): both nav link and route deleted outright — no /app/panel/invoices anymore
- Likely the clinic-facing surface for pdf-invoicing.md's work (viewing/resending invoices sent to their clients) — cross-reference that workflow before rebuilding this one, avoid duplicating scope

## Step: notifications-page
Status: not_started
Criteria:
- REMOVED (commit ce5f610): both nav link and route deleted outright
- Confirmed leftover/duplicate per this file's original note — /panel/settings/notifications already exists as a real tab under Settings, so removing the standalone nav item resolved the ambiguity rather than needing a separate decision

## Step: reports-page
Status: not_started
Criteria:
- REMOVED (commit ce5f610): both nav link and route deleted outright
- Scope undecided — likely business-analytics style (bookings over time, revenue, no-show rates) but nothing designed yet; revisit if/when this becomes a real priority

## Step: integrations-page
Status: not_started
Criteria:
- REMOVED (commit ce5f610): both nav link and route deleted outright
- Scope undecided — no specific integrations identified as wanted yet (e.g. calendar sync, other tools)

## Notes / Deviations
- CLEANUP DONE (commit ce5f610): Arun removed Pagos, Facturas, Notificaciones, Informes, and Integraciones from the sidebar. Invoices/notifications/reports/integrations routes were deleted outright; payments' route was left in place but unlinked — flagged above as worth confirming whether that was intentional.
- These remain valid post-MVP candidates to build later; removing the nav link doesn't remove the underlying idea, just declutters the panel until each one has a real design.
