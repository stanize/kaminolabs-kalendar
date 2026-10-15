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
- DECIDED (2026-10-15, second pass, Arun — "i am thinking that the pdf will be generated upon request"): GENERATE-ON-REQUEST, not generate-once-and-store. SUPERSEDES this step's original Supabase Storage proposal below (kept struck through/marked, not deleted, for history) — simpler architecture, no bucket, no upload step, no `pdf_url` column (see kalendar-invoices-schema). Every PDF (invoice-history-view's download link, and the emailed link — see send-invoice-action) is rendered fresh, live, on each request, from the `kalendar_invoices` row's already-snapshotted fields (amount, service_name, invoice_number, issue date — set once at creation, per sequential-numbering-allocation) plus the business's CURRENT settings (name/address/DNI/colegiada/logo, and whichever `invoice_template_id` the business currently has selected).
- KNOWN TRADE-OFF, flagged explicitly rather than silently accepted: the invoiced AMOUNTS/NUMBERS are historically stable (snapshotted in the row), but the VISUAL TEMPLATE is not — if a template's layout changes after an invoice was sent, re-downloading that old invoice later renders it in the new layout, not whatever it looked like when actually emailed. Acceptable for now per Arun (VERI*FACTU compliance, which would care more about this, is already deferred — see Notes below) — revisit if/when that lands.
- Route handler, not a server action, for the actual PDF response (a server action can't stream a binary file response the way a GET route can) — e.g. `app/api/invoices/[id]/pdf/route.ts`, auth-checked (business ownership of the invoice row) the same way other owner-scoped routes in this app are, returns `Content-Type: application/pdf`. Both invoice-history-view's download link and the emailed link point at this same route — one rendering code path, not two.
- ~~Generated PDF needs to be stored somewhere retrievable... Supabase Storage bucket... `pdf_url`...~~ SUPERSEDED above, 2026-10-15 second pass — kept only as a history pointer in case on-demand generation turns out to have a real performance/cost problem at scale and storing becomes worth revisiting.

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
- New table kalendar_invoices on the main Kalendar Supabase project: id, business_id (FK, cascade), booking_id (FK, nullable, set null on delete), invoice_number (text), issue_year (integer), client_name, client_email, service_name, amount (numeric, >= 0), sent_at (nullable), created_at
- NO `pdf_url`/`pdf_document_id` COLUMN AT ALL (2026-10-15, second pass — generate-on-request, per in-app-pdf-generation) — nothing to store, the PDF is rendered live from this row's own fields plus the business's current settings every time it's requested. This drops the first pass's `pdf_url` column entirely, not just renames it.
- amount/service_name are a snapshot at invoice-creation time, independent of the booking's own mutable fields — a booking's price could theoretically change later via edit, the invoice must stay historically accurate
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
- UPDATED (2026-10-15, second pass — generate-on-request removes the PDF-generation step from the send flow entirely, see in-app-pdf-generation/send-invoice-action): the number is allocated at row-creation time regardless of whether the EMAIL send that follows succeeds — if that fails, the number is still considered used and must never be reused. A failed send surfaces a clear retryable error; retrying re-attempts the email for the SAME existing row/number, never allocates a second number for the same logical invoice. (The original wording here referred to a "PDF-generation call" failing — no longer applicable, since PDF rendering only ever happens later, on-demand, and failing to render on one view attempt has no bearing on numbering at all.)

## Step: send-invoice-action
Status: not_started
Criteria:
- "Enviar factura" action added to the existing booking detail modal in the panel calendar — not a full-page redirect, matches Arun's existing modal-based-flow preference
- Available for ANY booking, not restricted to completed status only — a clinic may want to invoice at time of service regardless of Kalendar's own status field
- Scoped via the existing authedAction pattern — booking must belong to the caller's business
- UPDATED FLOW, SECOND PASS (2026-10-15, generate-on-request — per in-app-pdf-generation, supersedes the first pass's upload step below): allocate invoice number + insert kalendar_invoices row (transactional, per sequential-numbering-allocation) -> email the client via lib/email.ts (same branded-shell pattern as reminders/confirmations) with a link to the PDF route (`/api/invoices/[id]/pdf`, auth-checked separately for the client's access — see invoice-history-view/in-app-pdf-generation for the access-control question this raises) -> set sent_at. No PDF is rendered at send time at all anymore — only generated later, whenever that link (or the history view's download link) is actually opened.
- On a failed email send, surface a clear error ("invoice #2026-0007 was created but sending failed — retry") without rolling back the invoice number, per sequential-numbering-allocation. Retrying just re-attempts the email for the same row.
- OPEN QUESTION, NEW (2026-10-15, second pass): the PDF route needs SOME auth story for the CLIENT (not the clinic owner) to open their own invoice link from an email, without a Kalendar login — the owner-scoped `authedAction`/session pattern used everywhere else in this app doesn't fit a guest email recipient. Likely a signed/tokenized URL (same shape as `confirm_token` on `kalendar_bookings`, or the booking-cancellation token pattern already in this codebase) rather than a raw `/api/invoices/[id]/pdf` with no protection — NOT yet decided, flag before building send-invoice-action or in-app-pdf-generation's route handler.
- ~~-> look up the business's `invoice_template_id` -> assemble the template's props object (per invoice-content-payload) -> render to a PDF buffer in-app -> upload to Supabase Storage -> update the row with `pdf_url`~~ SUPERSEDED above, 2026-10-15 second pass — the template lookup + props assembly + rendering now all happen inside the PDF route handler itself, at request time, not inside this action.
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
- Shows invoice_number, client_name, amount, sent_at, and a download link — UPDATED (2026-10-15, second pass): links to the generate-on-request PDF route (`/api/invoices/[id]/pdf`, per in-app-pdf-generation), not a stored file; this view is reached from inside the panel so it's already behind the owner's normal session/authedAction-equivalent auth, unlike the emailed client-facing link (see send-invoice-action's open question about that one specifically).
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
- Testing checklist for whoever builds this (not itself a step, but should gate calling send-invoice-action/sequential-numbering-allocation done): send a real test invoice and confirm email + PDF content match (compare against the real podóloga example's layout where applicable); send two invoices same session same business, confirm sequential no-gap numbering; simulate an email-send failure and confirm the number is still allocated, a clear retryable error is shown, and retry reuses the same row rather than allocating a new number; confirm two different businesses' "first" invoices both correctly get 0001 (per-business scoping, not global); confirm the PDF route renders correctly on repeated requests for the same invoice (byte-identical content, since it's regenerated each time — not literally byte-identical as a PDF file, since renderers aren't always deterministic at that level, but identical in displayed content); confirm the emailed client-facing link's access control (per send-invoice-action's open question) actually restricts to that one invoice, not an enumerable `/api/invoices/[id]/pdf` by owner-only auth that a client can't satisfy.
- ARCHITECTURE CHANGE SUMMARY (2026-10-15, Arun, first pass): dropped the separate stanize/kaminolabs-pdfs portal entirely in favor of in-app `@react-pdf/renderer` generation. Per-clinic template CUSTOMIZATION (admin-template-editor, previously ruled fully out of scope) is still out of scope, but template SELECTION among a small, code-defined set is now explicitly in scope from the start (invoice-template-selection), a new distinction this pass introduces — selecting a premade template is not the same as customizing one.
- ARCHITECTURE CHANGE SUMMARY (2026-10-15, Arun, SECOND pass, same day — "i am thinking that the pdf will be generated upon request"): dropped the first pass's Supabase Storage / `pdf_url` plan entirely too — generate-on-request instead of generate-once-and-store. No bucket, no upload step, no stored file at all; every PDF view (owner's history-view download, client's emailed link) renders fresh from the kalendar_invoices row + the business's current settings. Simpler architecture, one trade-off accepted (template-layout drift on old invoices if a template's design changes later — see in-app-pdf-generation), and one new open question raised (client-facing link auth, since there's no file URL to just hand out anymore — see send-invoice-action).
- Per Arun's explicit instruction (2026-10-15): this is a KNOWN, EXPLICIT choice (link in the email, not an attachment) — generating once per email send to attach would reintroduce a second rendering context that generate-on-request was meant to avoid; emailing a link keeps exactly one PDF-rendering code path (the route handler) for both the owner's history view and the client's email.
- Per Arun's explicit instruction (2026-10-15): this session was spec-only — no code written. All steps above remain `not_started`/`superseded` pending a future build session.
