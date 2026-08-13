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
- /app/panel/payments/page.tsx exists but is explicitly a placeholder — its own code comment confirms this
- Intended scope per that comment: payments FROM the clinic's own clients (deposits, no-show charges, per-appointment payment status) — NOT the Kalendar SaaS subscription (that's /panel/settings/subscription, already built)
- kalendar_bookings.payment_status already exists in schema for this future build-out (paid/unpaid, set via updateBookingResult — see calendar-management-past.md's mark-payment step, which already covers the per-booking toggle)
- Not yet decided what this page adds beyond what mark-payment already covers — possibly a clinic-wide payments ledger/report view rather than new per-booking functionality

## Step: invoices-page
Status: not_started
Criteria:
- /app/panel/invoices route does not exist at all (not even a placeholder)
- Likely the clinic-facing surface for pdf-invoicing.md's work (viewing/resending invoices sent to their clients) — cross-reference that workflow before building this one, avoid duplicating scope

## Step: notifications-page
Status: not_started
Criteria:
- /app/panel/notifications route does not exist at all
- Scope undecided — could be a settings-style page (notification preferences, distinct from the existing /panel/settings/notifications tab which already exists) or an activity/notification feed. Needs a design decision before it's buildable.

## Step: reports-page
Status: not_started
Criteria:
- /app/panel/reports route does not exist at all
- Scope undecided — likely business-analytics style (bookings over time, revenue, no-show rates) but nothing designed yet

## Step: integrations-page
Status: not_started
Criteria:
- /app/panel/integrations route does not exist at all
- Scope undecided — no specific integrations identified as wanted yet (e.g. calendar sync, other tools)

## Notes / Deviations
- /panel/settings/notifications already exists as a real tab under Settings — worth confirming with Arun whether the standalone /panel/notifications nav item is meant to be something different, or is simply a leftover/duplicate that should be removed from the sidebar rather than built out.
- Since this file's purpose is pre-cleanup visibility, once Arun's cleanup pass happens (removing or hiding nav items that won't be built soon), this file should be revisited — items actually removed from the sidebar should be marked here as removed/deferred rather than left as not_started indefinitely.
