# Workflow: Clinic → Patient Invoicing (Kalendar side)

Lets a clinic owner manually generate and send a legally-valid invoice to a patient for a booking, from inside the panel. Rendered as a PDF by the separate stanize/kaminolabs-pdfs portal, delivered via a tokenized link over Kalendar's existing Resend email pipeline. This is an operational requirement for the clinic (invoicing their own patients) — explicitly NOT tied to Kalendar's own subscription/billing of the clinic, and not dependent on subscription-billing.md, which has been deferred out of MVP (see that file's notes).

Full spec provided by Arun on 2026-08-25 supersedes this file's earlier, less detailed version of the same idea — rewritten to match.

## Step: legal-requirements-check
Status: not_started
Criteria:
- Accountant/gestor consulted on exact Spanish factura requirements for a small independent clinic/professional BEFORE numbering logic or the JSON payload shape is finalized — this step blocks kalendar-invoices-schema's exact columns and invoice-content-payload's exact fields, not just numbering
- At minimum expect to confirm: sequential gap-free numbering (typically resets yearly, e.g. 2026-0001), issue date, both parties' identifying details (clinic's legal_id already exists; confirm whether a private individual patient needs a tax ID on a consumer invoice — likely not, but confirm), service description, amount
- VAT treatment specifically confirmed rather than assumed — many independent health/wellness professionals in Spain are VAT-exempt for their professional services; applying VAT incorrectly is worse than omitting it. Spec's default: build with VAT as a configurable-but-possibly-unused field, omit entirely from v1 if the accountant conversation says it's not needed for these business types

## Step: pdf-portal-api-dependency
Status: done
Criteria:
- Depends on stanize/kaminolabs-pdfs (pdfs.kaminolabs.dev) — this spec does not touch that repo, only calls it
- POST /api/generate exists on the portal side and pins the generated document to a specific template version
- GET /d/[id]?token= serves/caches the rendered PDF deterministically — invoice history view (below) can link directly to this without regenerating
- App-to-app auth: API-key-authenticated call with app_id: 'kalendar' — confirm the current /api/generate contract against the portal repo directly before wiring the call if this spec's assumptions are stale by build time
- v1 uses a single basic template (template_id: 'invoice') — per-clinic template customization and separate pending/paid template variants are explicitly out of scope for this pass (supersedes this file's earlier assumption of two templates)

## Step: kalendar-invoices-schema
Status: not_started
Criteria:
- New table kalendar_invoices on the main Kalendar Supabase project: id, business_id (FK, cascade), booking_id (FK, nullable, set null on delete), invoice_number (text), issue_year (integer), client_name, client_email, service_name, amount (numeric, >= 0), pdf_document_id (nullable), pdf_document_url (nullable), sent_at (nullable), created_at
- amount/service_name are a snapshot at invoice-creation time, independent of the booking's own mutable fields — a booking's price could theoretically change later via edit, the invoice must stay historically accurate
- pdf_document_id/url are nullable BY DESIGN — the row and its invoice number are created before calling the PDF portal, not after (see sequential-numbering-allocation for why)
- Unique index on (business_id, issue_year, invoice_number) — not globally unique, only unique within a business + year
- Indexes on business_id and booking_id (partial, where booking_id is not null)
- Matching drop table if exists ... cascade added to schema_001.sql's destructive drop block in the same change, per repo convention

## Step: sequential-numbering-allocation
Status: not_started
Criteria:
- HIGHEST-RISK PIECE of this whole feature — a numbering gap is a compliance problem, not just a bug
- Numbering is per business, per year, resetting to 0001 at the start of each calendar year
- Number allocated transactionally at the moment the kalendar_invoices row is created — single SQL statement reading the max existing number for that business+year and inserting the new row, inside one transaction, to avoid a race between two concurrent invoice creations for the same business
- Implementation mechanism (select ... for update on a per-business counter row, vs. a Postgres sequence-per-business pattern) is an implementation detail to decide once against existing Supabase RPC/function conventions in this codebase — not a design decision to debate mid-build
- Number is allocated regardless of whether the subsequent PDF-generation call succeeds — if that call fails, the number is still considered used and must never be reused. A failed send surfaces a clear retryable error; retrying re-attempts PDF generation for the SAME existing row/number, never allocates a second number for the same logical invoice
- Depends on legal-requirements-check for the exact numbering format (e.g. confirm "2026-0001" is the right format, not just "0001")

## Step: send-invoice-action
Status: not_started
Criteria:
- "Enviar factura" action added to the existing booking detail modal in the panel calendar — not a full-page redirect, matches Arun's existing modal-based-flow preference
- Available for ANY booking, not restricted to completed status only — a clinic may want to invoice at time of service regardless of Kalendar's own status field
- Scoped via the existing authedAction pattern — booking must belong to the caller's business
- Flow: allocate invoice number + insert kalendar_invoices row (transactional, per sequential-numbering-allocation) -> assemble JSON payload (per invoice-content-payload) -> call PDF portal's /api/generate -> on success, update the row with pdf_document_id/url, email the client via lib/email.ts using the same branded-shell pattern as reminders/confirmations, set sent_at -> on failure at generate or email step, surface a clear error ("invoice #2026-0007 was created but sending failed — retry") without rolling back the invoice number
- PDF_PORTAL_URL / PDF_PORTAL_API_KEY env vars: if unset, the action shows a clear "not configured" state rather than crashing — same pattern as how RESEND_API_KEY absence is already handled elsewhere in this codebase

## Step: invoice-content-payload
Status: not_started
Criteria:
- Depends on legal-requirements-check for final field list
- From kalendar_businesses: name, legal_id, full split address, contact_email, phone (country code + number)
- From the booking: client_name, client_email, service_name, service_price
- Generated at creation time: formatted invoice_number, issue_date
- Manual/booking-less invoicing (a clinic invoicing for something not tracked as a Kalendar booking) is assumed OUT of scope for MVP — confirm this assumption still holds before building, per the spec's own open question

## Step: invoice-history-view
Status: not_started
Criteria:
- A simple, read-only-for-MVP list of sent invoices per business — exact panel placement (new /panel/invoices route vs. nested under an existing area) to be confirmed against current nav conventions (see post-mvp-menu-items.md's invoices-page step, which tracked the empty nav slot before this spec existed — this build effectively fills that slot, that step should be marked accordingly once this lands)
- Shows invoice_number, client_name, amount, sent_at, and a working re-download link via the stored pdf_document_url (no regeneration needed — the portal serves this deterministically)
- No edit/void/re-issue actions in this pass — a wrong invoice is handled manually/offline for now, by explicit design decision

## Notes / Deviations
- OUT OF SCOPE for this pass, confirmed explicitly by the spec (not oversights): automatic invoicing on booking completion (stays manual/deliberate for MVP); editing/voiding/re-issuing a sent invoice; per-clinic template customization; multi-line-item/itemized invoices (v1 is strictly one invoice per one booking).
- Testing checklist for whoever builds this (not itself a step, but should gate calling send-invoice-action/sequential-numbering-allocation done): send a real test invoice and confirm email + PDF content match; send two invoices same session same business, confirm sequential no-gap numbering; simulate a PDF-portal-call failure (e.g. point PDF_PORTAL_URL at an invalid endpoint) and confirm the number is still allocated, a clear retryable error is shown, and retry reuses the same row rather than allocating a new number; confirm two different businesses' "first" invoices both correctly get 0001 (per-business scoping, not global); confirm the history view's download link keeps working after the fact via portal-side caching.
- This spec supersedes admin-template-editor from this file's earlier version — per-clinic template customization is explicitly out of scope for this pass, not just unbuilt. Removed as a step; revisit only if that scope changes later.
- pdf-portal-env-config (this file's earlier version) used APP_API_KEY_KALENDAR/PDFS_API_KEY naming — the new spec names these PDF_PORTAL_URL/PDF_PORTAL_API_KEY. Confirm the actual env var names against whatever's already provisioned (if anything) before building send-invoice-action, since a naming mismatch here would silently break the "not configured" fallback state.
