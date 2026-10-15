# Workflow: Clinic → Patient Invoicing (Kalendar side)

Lets a clinic owner manually generate and send a legally-valid invoice (factura)
to a patient for a booking, from inside the panel. ARCHITECTURE CHANGE
(2026-10-15, Arun): no longer delegates PDF rendering to the separate
stanize/kaminolabs-pdfs portal — generated entirely in-app with
`@react-pdf/renderer`, no external API call, no app-to-app auth, no portal
dependency at all. This is an operational requirement for the clinic
(invoicing their own patients) — explicitly NOT tied to Kalendar's own
subscription/billing of the clinic, and not dependent on
subscription-billing.md, which has been deferred out of MVP (see that
file's notes).

Grounded (2026-10-15) against a real factura Arun shared from a podóloga
client — see legal-requirements-check below for what it confirmed.

## Step: legal-requirements-check
Status: done
Criteria:
- GROUNDED (2026-10-15, Arun, via a real factura from a podóloga client — see image in session): this real-world example answers what the earlier version of this step was blocking on.
- VAT: CONFIRMED exempt for this business type — the real invoice reads "Operación exenta de I.V.A por el artículo 20 de la Ley 37/1992", no VAT line at all (not even a 0% line). DECIDED: this becomes the first invoice TEMPLATE (see invoice-template-selection below), not a configurable field on a single template — the VAT-exempt template simply has no VAT section in its layout. A future non-exempt template, if/when built, would be a structurally different template, not a toggle on this one.
- Numbering: the real example shows "N 0104 26" (a running sequence + 2-digit year, not a per-year reset). DECIDED (Arun, overriding the real example): Kalendar builds the spec's original per-year-reset format instead — `2026-0001`, resetting to `0001` every January 1st per business — since that's the more standard/compliant pattern. sequential-numbering-allocation below is unchanged by this grounding pass.
- Identifying details: the real invoice shows the professional's DNI and professional college registration number ("Nºcolegiada") alongside their name, in addition to the client's name and address — NOT previously captured anywhere in Kalendar's schema. DECIDED: add as new optional fields on `kalendar_businesses` (see professional-id-fields below), shown on the invoice when filled in.
- Client-side: only name + address shown, no tax ID for the patient (private individual) — confirms the spec's original assumption.
- Content/layout confirmed by the real example, to carry into the VAT-exempt template's design: professional's DNI + name + colegiada number (header), client name + address, invoice number + date, a CONCEPTOS table (service description + price + importe), the VAT-exemption legal citation box, total, and a signed "PAGADO" stamp area. The "PAGADO" stamp specifically is cosmetic/manual on the real paper invoice — Kalendar's own invoice doesn't need a literal signature, but should show payment status clearly (ties into calendar-management-past.md's existing Cobrar/paid_at data, which already exists — see invoice-content-payload below for how it's wired in).

## Step: pdf-portal-api-dependency
Status: superseded
Criteria:
- SUPERSEDED (2026-10-15, Arun — "i am considering dropping the whole separate pdf portal for now, this will be built within the kalendar portal"): the stanize/kaminolabs-pdfs dependency is DROPPED for this feature. Replaced by in-app-pdf-generation below. This step's original criteria (POST /api/generate, GET /d/[id]?token=, app-to-app API-key auth, template_id: 'invoice') are no longer the plan — kept here as a pointer/history only, not deleted, in case the external-portal approach is ever revisited for a different feature.
- No PDF_PORTAL_URL / PDF_PORTAL_API_KEY env vars needed for this feature as a result — send-invoice-action below no longer has a "not configured" fallback state to handle, since there's no external dependency to be unconfigured.

## Step: in-app-pdf-generation
Status: not_started
Criteria:
- NEW STEP (2026-10-15, Arun), replacing pdf-portal-api-dependency. PDFs are rendered directly inside the Next.js app using `@react-pdf/renderer` — DECIDED over a headless-browser approach (Puppeteer/Playwright) specifically for Vercel/serverless friendliness (no chromium binary to bundle/cold-start) and because the invoice layout is structured/tabular, not design-heavy, so React-PDF's primitive-based layout is a good fit — matches the real example's plain table-and-boxes structure.
- Each invoice template (see invoice-template-selection) is a `@react-pdf/renderer` React component taking a typed props object (business details + DNI/colegiada, client details, invoice number/date, line item, payment status) and rendering to a PDF buffer server-side (a Next.js server action or Route Handler, not a client component — `@react-pdf/renderer`'s `renderToBuffer`/`renderToStream`).
- Generated PDF needs to be stored somewhere retrievable for invoice-history-view's re-download link (not regenerated live on every view, to keep historical invoices byte-stable once sent) — DEFAULT PROPOSAL (not yet confirmed with Arun): a new Supabase Storage bucket (e.g. `invoices`, same pattern as the existing `business-logos` bucket — see business.md's logo-upload), one object per invoice, uploaded right after generation; `kalendar_invoices.pdf_url` (see kalendar-invoices-schema) stores the resulting public/signed URL. Confirm this storage approach with Arun before building — flagged as the one piece of this architecture change not yet explicitly signed off.
- OPEN QUESTION: PDF file naming/path convention in the bucket (e.g. `{business_id}/{issue_year}/{invoice_number}.pdf`) — not yet decided, low-stakes, decide at build time.

## Step: invoice-template-selection
Status: not_started
Criteria:
- NEW STEP (2026-10-15, Arun — "I am planning to build templates... I want to add this to the settings page. There the clinic can choose the template"): invoice templates are selectable per-business from Settings, not auto-derived from business type.
- DECIDED (2026-10-15, Arun): only ONE template exists for this first pass — the VAT-exempt template grounded in legal-requirements-check above. The selection UI/mechanism is still built now (not deferred), even with a single option, so adding a second template later is just "add another option," not a re-design.
- New `kalendar_businesses.invoice_template_id` (text, NOT NULL, default `'vat-exempt'` — the only value that exists yet) — DECIDED to store a string id (matching e.g. bonos.md's/whatsapp-booking.md's existing text-enum-ish column patterns) rather than a FK to a templates table, since templates are code (React components), not data rows.
- New Settings tab/section (placement TBD — likely `/panel/settings/invoicing` as a new tab alongside the existing Reservas/Idioma/Notificaciones/Seguridad/Suscripción tabs, `app/panel/settings/`) where the clinic picks their template from a dropdown/radio of available `invoice_template_id` values. With only one template available at build time, this still renders (not hidden) — a single pre-selected, disabled-looking option is fine, per Arun's explicit ask to build the mechanism now.
- A template registry (e.g. `lib/invoices/templates.ts` mapping `invoice_template_id` -> `{ label, component }`) is the natural implementation shape — exact module layout is an implementation detail, not a design decision to pin down further here.

## Step: professional-id-fields
Status: not_started
Criteria:
- NEW STEP (2026-10-15, Arun — "Yes — add DNI + colegiada number to Negocio"), grounded by legal-requirements-check's real invoice example.
- New `kalendar_businesses` columns: `professional_dni` (text, nullable) and `professional_college_number` (text, nullable) — both optional (not every business type is a regulated profession with a colegiada number; a beauty salon or fitness coach wouldn't have one). Naming deliberately distinct from the existing `legal_id` (NIF/CIF business tax id) — these are the INDIVIDUAL professional's personal DNI and their professional college registration, a different concept the schema didn't capture before.
- Shown on the Negocio page (`app/panel/business/page.tsx`, `components/panel/business-form.tsx`) as two new optional fields, likely near `legal_id` given the conceptual similarity (identifying-info section) — exact placement TBD at build time.
- Both fields appear on the generated invoice (VAT-exempt template) when filled in, omitted/blank when not — matches the real example's "DNI: ... / [Name]. Podóloga Nºcolegiada: ..." header line, but gracefully degrades for a business that hasn't filled these in.

## Step: kalendar-invoices-schema
Status: not_started
Criteria:
- New table kalendar_invoices on the main Kalendar Supabase project: id, business_id (FK, cascade), booking_id (FK, nullable, set null on delete), invoice_number (text), issue_year (integer), client_name, client_email, service_name, amount (numeric, >= 0), pdf_url (nullable), sent_at (nullable), created_at
- RENAMED from the earlier version's `pdf_document_id`/`pdf_document_url` (portal-specific) to a single `pdf_url` (2026-10-15) — reflects in-app-pdf-generation's Supabase Storage approach instead of an external portal's document id + URL pair.
- amount/service_name are a snapshot at invoice-creation time, independent of the booking's own mutable fields — a booking's price could theoretically change later via edit, the invoice must stay historically accurate
- `pdf_url` is nullable BY DESIGN — the row and its invoice number are created before the PDF is generated/uploaded, not after (see sequential-numbering-allocation for why)
- Unique index on (business_id, issue_year, invoice_number) — not globally unique, only unique within a business + year
- Indexes on business_id and booking_id (partial, where booking_id is not null)
- Matching drop table if exists ... cascade added to schema_001.sql's destructive drop block in the same change, per repo convention

## Step: sequential-numbering-allocation
Status: not_started
Criteria:
- HIGHEST-RISK PIECE of this whole feature — a numbering gap is a compliance problem, not just a bug
- CONFIRMED (2026-10-15, Arun, via legal-requirements-check): per-year reset format, `2026-0001` style — Arun explicitly chose this over the real example's running-sequence format. No change to this step's design from the earlier version.
- Numbering is per business, per year, resetting to 0001 at the start of each calendar year
- Number allocated transactionally at the moment the kalendar_invoices row is created — single SQL statement reading the max existing number for that business+year and inserting the new row, inside one transaction, to avoid a race between two concurrent invoice creations for the same business
- Implementation mechanism (select ... for update on a per-business counter row, vs. a Postgres sequence-per-business pattern) is an implementation detail to decide once against existing Supabase RPC/function conventions in this codebase — not a design decision to debate mid-build
- Number is allocated regardless of whether the subsequent PDF-generation call succeeds — if that call fails, the number is still considered used and must never be reused. A failed send surfaces a clear retryable error; retrying re-attempts PDF generation for the SAME existing row/number, never allocates a second number for the same logical invoice

## Step: send-invoice-action
Status: not_started
Criteria:
- "Enviar factura" action added to the existing booking detail modal in the panel calendar — not a full-page redirect, matches Arun's existing modal-based-flow preference
- Available for ANY booking, not restricted to completed status only — a clinic may want to invoice at time of service regardless of Kalendar's own status field
- Scoped via the existing authedAction pattern — booking must belong to the caller's business
- UPDATED FLOW (2026-10-15, no external portal): allocate invoice number + insert kalendar_invoices row (transactional, per sequential-numbering-allocation) -> look up the business's `invoice_template_id` -> assemble the template's props object (per invoice-content-payload) -> render to a PDF buffer in-app (`@react-pdf/renderer`, per in-app-pdf-generation) -> upload to Supabase Storage -> update the row with `pdf_url` -> email the client via lib/email.ts using the same branded-shell pattern as reminders/confirmations, set sent_at -> on failure at any step after the row is created, surface a clear error ("invoice #2026-0007 was created but sending failed — retry") without rolling back the invoice number
- No "PDF portal not configured" fallback state needed anymore (superseded along with pdf-portal-api-dependency) — the only external dependency left in this flow is Resend (lib/email.ts), which already has its own existing env-gated degrade-gracefully pattern.

## Step: invoice-content-payload
Status: not_started
Criteria:
- RENAMED IN SPIRIT (2026-10-15): this is now the React-PDF template's PROPS shape, not a JSON payload sent to an external API — same field list, different consumer.
- From `kalendar_businesses`: name, `legal_id`, full split address, contact_email, phone (country code + number), and (new, per professional-id-fields) `professional_dni` + `professional_college_number`, both optional/nullable in the props.
- From the booking: client_name, client_email, service_name, service_price, and (new, per legal-requirements-check's content note) payment status — whether the invoiced booking is marked paid (`payment_status`/`paid_at`, already exists per calendar-management-past.md's Cobrar work) so the template can show a payment-status indicator, matching the real example's "PAGADO" stamp in spirit without literally reproducing a signature.
- Generated at creation time: formatted invoice_number, issue_date
- Manual/booking-less invoicing (a clinic invoicing for something not tracked as a Kalendar booking) is assumed OUT of scope for MVP — confirm this assumption still holds before building, per the spec's own open question

## Step: invoice-history-view
Status: not_started
Criteria:
- A simple, read-only-for-MVP list of sent invoices per business — exact panel placement (new /panel/invoices route vs. nested under an existing area) to be confirmed against current nav conventions (see post-mvp-menu-items.md's invoices-page step, which tracked the empty nav slot before this spec existed — this build effectively fills that slot, that step should be marked accordingly once this lands)
- Shows invoice_number, client_name, amount, sent_at, and a working re-download link via the stored `pdf_url` (Supabase Storage, per kalendar-invoices-schema — no regeneration needed, served directly)
- No edit/void/re-issue actions in this pass — a wrong invoice is handled manually/offline for now, by explicit design decision

## Notes / Deviations
- FUTURE DEPENDENCY (2026-09-27): `workflows/verifactu-compliance.md` (Spain's
  anti-fraud invoicing regulation — hash-chained records, QR codes,
  possible AEAT submission) extends this feature and depends on at least
  `kalendar-invoices-schema` + `sequential-numbering-allocation` existing
  first. Arun's plan is to design/build that WITH Kalendar's first real
  client rather than speculatively now — see that file. Worth keeping in
  mind that a later VERI*FACTU pass will likely add columns to
  `kalendar_invoices` and touch the PDF-generation payload, so avoid
  assuming this schema is permanently final once it ships.
- OUT OF SCOPE for this pass, confirmed explicitly by the spec (not oversights): automatic invoicing on booking completion (stays manual/deliberate for MVP); editing/voiding/re-issuing a sent invoice; multi-line-item/itemized invoices (v1 is strictly one invoice per one booking).
- Testing checklist for whoever builds this (not itself a step, but should gate calling send-invoice-action/sequential-numbering-allocation done): send a real test invoice and confirm email + PDF content match (compare against the real podóloga example's layout where applicable); send two invoices same session same business, confirm sequential no-gap numbering; simulate a PDF-generation or Storage-upload failure and confirm the number is still allocated, a clear retryable error is shown, and retry reuses the same row rather than allocating a new number; confirm two different businesses' "first" invoices both correctly get 0001 (per-business scoping, not global); confirm the history view's download link keeps working after the fact.
- ARCHITECTURE CHANGE SUMMARY (2026-10-15, Arun, this pass): dropped the separate stanize/kaminolabs-pdfs portal entirely in favor of in-app `@react-pdf/renderer` generation + Supabase Storage for the resulting files. Per-clinic template CUSTOMIZATION (admin-template-editor, previously ruled fully out of scope) is still out of scope, but template SELECTION among a small, code-defined set is now explicitly in scope from the start (invoice-template-selection), a new distinction this pass introduces — selecting a premade template is not the same as customizing one.
- pdf-portal-env-config / PDF_PORTAL_URL / PDF_PORTAL_API_KEY naming notes from earlier versions of this file are now moot — no longer applicable, kept out of this version rather than carried forward as dead context.
- STILL OPEN, not yet confirmed with Arun: the Supabase Storage bucket approach for storing generated PDFs (in-app-pdf-generation's "DEFAULT PROPOSAL" note) — reasonable default, but flag it for explicit confirmation before building kalendar-invoices-schema's `pdf_url` column or the upload logic.
- Per Arun's explicit instruction (2026-10-15): this session was spec-only — no code written. All steps above remain `not_started`/`superseded` pending a future build session.
