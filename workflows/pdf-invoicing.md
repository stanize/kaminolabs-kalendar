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

CODE IMPLEMENTED, TYPECHECKED, LINTED, BUILD PASSES (2026-10-15) — every
step below except legal-requirements-check (already `done`) and
pdf-portal-api-dependency (`superseded`, not built) is `in_progress`:
code written this session, pending Arun's manual/live testing (migration
not yet run against the live DB either). See each step's own criteria for
exactly what shipped. High-level summary: `supabase/schema_subset_023.sql`
(kalendar_invoices table, allocate_invoice_number function, new
kalendar_businesses columns, invoice-signatures bucket); `lib/invoices/`
(data layer, @react-pdf/renderer VAT-exempt template, render-on-request
helper); `app/api/invoices/[id]/pdf/route.ts`; `lib/actions/invoices.ts`
(create+send, resend, settings actions); the Facturación settings tab
(`/panel/settings/invoicing`); the Facturas page (`/panel/invoices`);
professional-id-fields on Negocio; and the Cobrar-triggered invoice
confirm modal in `components/panel/booking-detail-modal.tsx`.

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
Status: in_progress
Criteria:
- NEW STEP (2026-10-15, Arun), replacing pdf-portal-api-dependency. PDFs are rendered directly inside the Next.js app using `@react-pdf/renderer` — DECIDED over a headless-browser approach (Puppeteer/Playwright) specifically for Vercel/serverless friendliness (no chromium binary to bundle/cold-start) and because the invoice layout is structured/tabular, not design-heavy, so React-PDF's primitive-based layout is a good fit — matches the real example's plain table-and-boxes structure.
- Each invoice template (see invoice-template-selection) is a `@react-pdf/renderer` React component taking a typed props object (business details + DNI/colegiada, client details, invoice number/date, line item, payment status) and rendering to a PDF buffer server-side (a Next.js server action or Route Handler, not a client component — `@react-pdf/renderer`'s `renderToBuffer`/`renderToStream`).
- DECIDED (2026-10-15, second pass, Arun — "i am thinking that the pdf will be generated upon request"): GENERATE-ON-REQUEST, not generate-once-and-store. SUPERSEDES this step's original Supabase Storage proposal below (kept struck through/marked, not deleted, for history) — simpler architecture, no bucket, no upload step, no `pdf_url` column (see kalendar-invoices-schema). Every PDF (facturas-page's download link, and the emailed link — see send-invoice-action) is rendered fresh, live, on each request, from the `kalendar_invoices` row's already-snapshotted fields (amount, service_name, invoice_number, issue date — set once at creation, per sequential-numbering-allocation) plus the business's CURRENT settings (name/address/DNI/colegiada/logo, and whichever `invoice_template_id` the business currently has selected).
- KNOWN TRADE-OFF, flagged explicitly rather than silently accepted: the invoiced AMOUNTS/NUMBERS are historically stable (snapshotted in the row), but the VISUAL TEMPLATE is not — if a template's layout changes after an invoice was sent, re-downloading that old invoice later renders it in the new layout, not whatever it looked like when actually emailed. Acceptable for now per Arun (VERI*FACTU compliance, which would care more about this, is already deferred — see Notes below) — revisit if/when that lands.
- Route handler, not a server action, for the actual PDF response (a server action can't stream a binary file response the way a GET route can) — e.g. `app/api/invoices/[id]/pdf/route.ts`, auth-checked (business ownership of the invoice row) the same way other owner-scoped routes in this app are, returns `Content-Type: application/pdf`. Both facturas-page's download link and the emailed link point at this same route — one rendering code path, not two.
- ~~Generated PDF needs to be stored somewhere retrievable... Supabase Storage bucket... `pdf_url`...~~ SUPERSEDED above, 2026-10-15 second pass — kept only as a history pointer in case on-demand generation turns out to have a real performance/cost problem at scale and storing becomes worth revisiting.

## Step: invoice-template-selection
Status: in_progress
Criteria:
- NEW STEP (2026-10-15, Arun — "I am planning to build templates... I want to add this to the settings page. There the clinic can choose the template"): invoice templates are selectable per-business from Settings, not auto-derived from business type.
- DECIDED (2026-10-15, Arun): only ONE template exists for this first pass — the VAT-exempt template grounded in legal-requirements-check above. The selection UI/mechanism is still built now (not deferred), even with a single option, so adding a second template later is just "add another option," not a re-design.
- New `kalendar_businesses.invoice_template_id` (text, NOT NULL, default `'vat-exempt'` — the only value that exists yet) — DECIDED to store a string id (matching e.g. bonos.md's/whatsapp-booking.md's existing text-enum-ish column patterns) rather than a FK to a templates table, since templates are code (React components), not data rows.
- New Settings tab/section (placement TBD — likely `/panel/settings/invoicing` as a new tab alongside the existing Reservas/Idioma/Notificaciones/Seguridad/Suscripción tabs, `app/panel/settings/`) where the clinic picks their template from a dropdown/radio of available `invoice_template_id` values. With only one template available at build time, this still renders (not hidden) — a single pre-selected, disabled-looking option is fine, per Arun's explicit ask to build the mechanism now.
- A template registry (e.g. `lib/invoices/templates.ts` mapping `invoice_template_id` -> `{ label, component }`) is the natural implementation shape — exact module layout is an implementation detail, not a design decision to pin down further here.

## Step: signature-upload
Status: in_progress
Criteria:
- NEW STEP (2026-10-15, fourth pass, Arun — "there is an actual signature in the invoice, how can this be managed? ... the clinic can upload a signature image under the invoices tab in settings, and if there is an image, this image will be used"), grounded by the real example's handwritten signature over the "PAGADO" stamp.
- New `kalendar_businesses.signature_url` (text, nullable) — DECIDED to mirror the existing logo-upload pattern exactly (`lib/actions/business.ts`'s `uploadBusinessLogo`/`removeBusinessLogo`, `logo_url` column, `business-logos` Supabase Storage bucket): same shape, new `uploadInvoiceSignature`/`removeInvoiceSignature` actions, a new `invoice-signatures` bucket (kept separate from `business-logos` rather than reused — different purpose, different place it's shown, no reason to conflate the two in storage even though the upload UI pattern is identical).
- Same constraints as logo-upload, reused rather than re-decided: 2MB max file size, image formats — but NARROWED from logo-upload's set: `image/png`, `image/jpeg`, `image/webp` only, deliberately EXCLUDING `image/svg+xml` this time (a signature is a scanned/photographed handwritten mark, never a vector graphic, unlike a logo which legitimately can be).
- UI lives on the SAME new Settings tab as invoice-template-selection (`/panel/settings/invoicing`) — "under the invoices tab in settings," per Arun — not on the Negocio page alongside the logo, even though the upload mechanics are copied from there. Grouped with the other invoice-specific settings (template choice), not with the general business-identity settings.
- DECIDED (Arun): conditional rendering, not a placeholder — when `signature_url` is set, the VAT-exempt template renders the uploaded image in the signature area of the invoice; when null (not yet uploaded), that area is simply omitted/blank, no fallback text, no generic stamp graphic. Matches invoice-content-payload's existing "gracefully degrades" pattern for the optional DNI/colegiada fields (professional-id-fields) — same philosophy, applied here too.
- Business-level, not booking-level or invoice-level — one signature image per business, reused across every invoice sent, same as the logo. No per-invoice override in this pass.

## Step: professional-id-fields
Status: in_progress
Criteria:
- NEW STEP (2026-10-15, Arun — "Yes — add DNI + colegiada number to Negocio"), grounded by legal-requirements-check's real invoice example.
- New `kalendar_businesses` columns: `professional_dni` (text, nullable) and `professional_college_number` (text, nullable) — both optional (not every business type is a regulated profession with a colegiada number; a beauty salon or fitness coach wouldn't have one). Naming deliberately distinct from the existing `legal_id` (NIF/CIF business tax id) — these are the INDIVIDUAL professional's personal DNI and their professional college registration, a different concept the schema didn't capture before.
- Shown on the Negocio page (`app/panel/business/page.tsx`, `components/panel/business-form.tsx`) as two new optional fields, likely near `legal_id` given the conceptual similarity (identifying-info section) — exact placement TBD at build time.
- Both fields appear on the generated invoice (VAT-exempt template) when filled in, omitted/blank when not — matches the real example's "DNI: ... / [Name]. Podóloga Nºcolegiada: ..." header line, but gracefully degrades for a business that hasn't filled these in.

## Step: kalendar-invoices-schema
Status: in_progress
Criteria:
- New table kalendar_invoices on the main Kalendar Supabase project: id, business_id (FK, cascade), booking_id (FK, nullable, set null on delete), invoice_number (text), issue_year (integer), client_name, client_email, service_name, payment_method (text, nullable, snapshot of the booking's cash/card/bono at invoice-creation time — see facturas-page's payment-method filter), amount (numeric, >= 0), access_token (text, not null, unique), sent_at (nullable), created_at
- `payment_method` ADDED (2026-10-15, fifth pass — facturas-page needs to filter by it, per Arun). Snapshotted at creation like `amount`/`service_name` — since invoice-on-payment-trigger only ever fires right after a successful Cobrar, this is simply the method the clinic just selected in that same action, not a separate lookup.
- `access_token` ADDED (2026-10-15, third pass — resolves send-invoice-action's open question below): a random, unguessable token (`randomBytes(24).toString("base64url")`, same generation call `kalendar_bookings.confirm_token` already uses — `lib/actions/booking.ts`) generated once at row-creation time, alongside the invoice number. DECIDED (Arun): the client-facing PDF link needs NO login at all — `/api/invoices/[id]/pdf?token=...`, checked against this column, grants access to that one invoice to anyone holding the link, including if the email is forwarded. Same security model as `confirm_token`'s existing cancel/confirm links — unguessable-token-as-bearer-credential, not a real auth system, which is the deliberately accepted trade-off for a document link like this (same as most invoice/receipt emails from any SaaS).
- Indexed (`kalendar_invoices_access_token_idx`), same pattern as `kalendar_bookings_token_idx` on `confirm_token` — the PDF route looks up by token, not by id+ownership-check, for the client-facing path.
- NO `pdf_url`/`pdf_document_id` COLUMN AT ALL (2026-10-15, second pass — generate-on-request, per in-app-pdf-generation) — nothing to store, the PDF is rendered live from this row's own fields plus the business's current settings every time it's requested. This drops the first pass's `pdf_url` column entirely, not just renames it.
- amount/service_name are a snapshot at invoice-creation time, independent of the booking's own mutable fields — a booking's price could theoretically change later via edit, the invoice must stay historically accurate
- Unique index on (business_id, issue_year, invoice_number) — not globally unique, only unique within a business + year
- Indexes on business_id and booking_id (partial, where booking_id is not null)
- Matching drop table if exists ... cascade added to schema_001.sql's destructive drop block in the same change, per repo convention

## Step: sequential-numbering-allocation
Status: in_progress
Criteria:
- HIGHEST-RISK PIECE of this whole feature — a numbering gap is a compliance problem, not just a bug
- CONFIRMED (2026-10-15, Arun, via legal-requirements-check): per-year reset format, `2026-0001` style — Arun explicitly chose this over the real example's running-sequence format. No change to this step's design from the earlier version.
- Numbering is per business, per year, resetting to 0001 at the start of each calendar year
- Number allocated transactionally at the moment the kalendar_invoices row is created — single SQL statement reading the max existing number for that business+year and inserting the new row, inside one transaction, to avoid a race between two concurrent invoice creations for the same business
- Implementation mechanism (select ... for update on a per-business counter row, vs. a Postgres sequence-per-business pattern) is an implementation detail to decide once against existing Supabase RPC/function conventions in this codebase — not a design decision to debate mid-build
- UPDATED (2026-10-15, second pass — generate-on-request removes the PDF-generation step from the send flow entirely, see in-app-pdf-generation/send-invoice-action): the number is allocated at row-creation time regardless of whether the EMAIL send that follows succeeds — if that fails, the number is still considered used and must never be reused. A failed send surfaces a clear retryable error; retrying re-attempts the email for the SAME existing row/number, never allocates a second number for the same logical invoice. (The original wording here referred to a "PDF-generation call" failing — no longer applicable, since PDF rendering only ever happens later, on-demand, and failing to render on one view attempt has no bearing on numbering at all.)

## Step: send-invoice-action
Status: in_progress
Criteria:
- The underlying create-and-email primitive — `createAndSendInvoice(bookingId, clientEmail?)` or equivalent — called from invoice-on-payment-trigger below (the only creation entry point, per Arun: "the invoice should be generated when an appointment is marked as paid") and from facturas-page's resend action for an invoice that already exists. This step itself is no longer a standalone "Enviar factura" button in the booking modal — SUPERSEDED, see invoice-on-payment-trigger.
- Scoped via the existing authedAction pattern — booking must belong to the caller's business
- FLOW: allocate invoice number + insert kalendar_invoices row (transactional, per sequential-numbering-allocation) -> email the client via lib/email.ts (same branded-shell pattern as reminders/confirmations) with a link to the PDF route (`/api/invoices/[id]/pdf?token={access_token}`, per kalendar-invoices-schema's `access_token` — no login, token alone grants access, same trust model as existing booking confirm/cancel links, works even if forwarded) -> set sent_at. No PDF is rendered at creation/send time — only generated later, whenever that link (or facturas-page's download link) is actually opened, per in-app-pdf-generation's generate-on-request decision.
- On a failed email send, surface a clear error ("invoice #2026-0007 was created but sending failed — retry") without rolling back the invoice number, per sequential-numbering-allocation. Retrying just re-attempts the email for the same row.
- No "PDF portal not configured" fallback state needed anymore (superseded along with pdf-portal-api-dependency) — the only external dependency left in this flow is Resend (lib/email.ts), which already has its own existing env-gated degrade-gracefully pattern.

## Step: invoice-on-payment-trigger
Status: in_progress
Criteria:
- NEW STEP (2026-10-15, fifth pass, Arun — "the invoice should be generated when an appointment is marked as paid"). Invoice creation is now triggered exclusively by a successful Cobrar (`handleCobrar`, `components/panel/booking-detail-modal.tsx`, calendar-management-past.md) — not a standalone button, and not available for an unpaid booking. This narrows send-invoice-action's earlier "available for any booking" framing — superseded by this step.
- DECIDED (Arun): after a successful Cobrar, a confirm modal asks "¿Quieres generar una factura?" (Sí/No). On "Sí", calls send-invoice-action for that booking. On "No", nothing happens — no invoice, no further prompt for that payment.
- AUTO-INVOICE SETTING (new, per the companion step auto-invoice-setting below): when the business has auto-invoice enabled, this confirm modal is SKIPPED ENTIRELY — Cobrar generates and sends the invoice automatically, no extra click. The modal only ever appears when auto-invoice is off (the default).
- DECIDED, ONE-INVOICE-PER-BOOKING (Arun — "never auto generate a second invoice, any changes which will affect the generated invoice will have to be handled in the invoice page"): before showing the confirm modal (or auto-generating), check whether a `kalendar_invoices` row already exists for this `booking_id`. If one does, skip the prompt/auto-generation entirely — a correction via Editar (cash -> card, or re-running Cobrar after a mistake) NEVER creates a second invoice or re-prompts. Any invoice-level correction after the fact is a manual action on facturas-page (not yet specced as an edit/void feature there either — see facturas-page's existing "no edit/void" note, which still holds; a wrong invoice stays a manual/offline fix for now, this step doesn't change that).
- MISSING-EMAIL HANDLING (ties into facturas-page's identical need, see that step's own note for the shared mechanism): if the booking's client has no real email on file (same `hasRealEmail` check already used in booking-detail-modal.tsx — excludes the `sin-email+` manual-booking placeholder and the WhatsApp sentinel address), the Sí/No confirm step becomes a small inline email-entry field instead of a bare Sí/No — the clinic types an email right there to proceed. Entered email is saved back to the client's profile (`kalendar_clients`, per Arun's decision) so future invoices/communications don't ask again, in addition to being used as this invoice's `client_email`.
- RESOLVED (2026-10-15, sixth pass, Arun — "if a client id does not exist at time of generating an invoice, generate a dummy one"): if the booking has no `clinic_client_id` link at invoice-generation time, a `kalendar_clients` row is created on the spot (same shape client-linking-on-booking already creates for a normal guest booking — name/email/phone from the booking's own `client_name`/`client_email`/`client_phone`), and the booking's `clinic_client_id` is backfilled to point at it, before proceeding with the rest of the flow. This isn't really a "dummy" row in the placeholder sense — it's a real client record built from whatever real data the booking already has, just created late instead of at booking time (the normal path per client-linking-on-booking, which this only covers the rare gap in — e.g. a very old booking that predates that linking). Reuses `client-linking-on-booking`'s own creation logic/shape rather than inventing a second, parallel client-creation code path.
- ALTERNATE-EMAIL OVERRIDE (2026-10-15, sixth pass, Arun — "there should be an option to send the invoice to a different email as well"): alongside the Sí/No confirm (or the missing-email inline field above), an optional "¿Enviar a otro email?" field lets the clinic type a one-off alternate address for this specific send — e.g. an accountant, a relative, a different contact than the client's own. DECIDED (Arun, explicitly): this is a ONE-TIME OVERRIDE ONLY — it does NOT update the client's saved profile email (unlike the missing-email case above, which does save). The alternate address is used as this invoice's own `client_email` (per kalendar-invoices-schema) for this one row; the client's `kalendar_clients` email is left untouched. Same override field is offered on facturas-page's Reenviar action (see that step) — one shared UI affordance, not two separate implementations.

## Step: auto-invoice-setting
Status: in_progress
Criteria:
- NEW STEP (2026-10-15, fifth pass, Arun — "this should also be a settings, auto invoice - (when appointments are paid)"). New `kalendar_businesses.auto_invoice_enabled` (boolean, NOT NULL, default `false`) — off by default, matching this codebase's existing convention for new opt-in flags (e.g. bonos.md's `bonos_enabled`, clinic-configuration.md's bonos-visibility-toggle).
- Lives on the SAME Invoicing settings tab as invoice-template-selection and signature-upload (`/panel/settings/invoicing`) — grouped with the other invoice-specific settings, labeled something like "Factura automática" with a short explainer ("Genera y envía la factura automáticamente al marcar una cita como pagada, sin preguntar cada vez").
- Purely a trigger-behavior flag — see invoice-on-payment-trigger for exactly what it skips (the confirm modal only, nothing else about numbering/content/sending changes).

## Step: invoice-content-payload
Status: in_progress
Criteria:
- RENAMED IN SPIRIT (2026-10-15): this is now the React-PDF template's PROPS shape, not a JSON payload sent to an external API — same field list, different consumer.
- From `kalendar_businesses`: name, `legal_id`, full split address, contact_email, phone (country code + number), (per professional-id-fields) `professional_dni` + `professional_college_number`, and (new, per signature-upload) `signature_url` — all four optional/nullable in the props, each independently omitted from the rendered PDF when not filled in.
- From the booking: client_name, client_email, service_name, service_price, and (new, per legal-requirements-check's content note) payment status — whether the invoiced booking is marked paid (`payment_status`/`paid_at`, already exists per calendar-management-past.md's Cobrar work) so the template can show a payment-status indicator, matching the real example's "PAGADO" stamp in spirit without literally reproducing a signature.
- Generated at creation time: formatted invoice_number, issue_date
- Manual/booking-less invoicing (a clinic invoicing for something not tracked as a Kalendar booking) is assumed OUT of scope for MVP — confirm this assumption still holds before building, per the spec's own open question

## Step: invoice-concepts-list
Status: in_progress
Criteria (design + build 2026-10, Arun, from real clinic feedback via Bea's
translated voice memo — code implemented + typechecked/linted/built same
session, PENDING MANUAL/LIVE TESTING; this step existed only as scattered
backlog-entry references until this pass, written up properly now):
- PROBLEM: a clinic sometimes wants a predefined, reusable list of extra
  billing line-item text to pick from at invoice-generation time (Bea's
  example: "Quiropodia"), on top of the booking's own service name, rather
  than typing something ad hoc every time.
- Blank slate by design (explicit Arun call, point 5 of the design
  discussion) — no starter list seeded for any business; each clinic
  builds its own from scratch.
- Schema: `kalendar_invoice_concepts` (`schema_subset_029.sql`, folded
  into `schema_001.sql`) — `id`, `business_id`, `label`, case-insensitive
  unique per business (`(business_id, lower(label))`).
- `lib/invoices/concepts.ts` — `getInvoiceConcepts`,
  `findOrCreateInvoiceConcept` (case-insensitive lookup-or-insert, shared
  by both the explicit Settings "add" action and the confirm modal's
  auto-add-on-custom-entry path), `renameInvoiceConcept`,
  `deleteInvoiceConcept`.
- Settings → Facturación gets a "Conceptos de factura" section
  (`components/panel/invoice-concepts-settings.tsx`) — add/rename/delete,
  wired through `lib/actions/invoices.ts`'s `listInvoiceConcepts`/
  `addInvoiceConcept`/`updateInvoiceConcept`/`removeInvoiceConcept`.
- REVISED MID-BUILD (same session, per a follow-up screenshot from Arun):
  the confirm modal's field was first built as a single "Concepto de
  factura" input that REPLACED the booking's service name outright —
  corrected to a two-field layout instead: a read-only "Servicio" line
  (always the booking's actual service name, always the invoice's first
  line — changing it is the separate, parked
  `backlog.md` Cobrar-time-override idea, not this feature) plus an
  OPTIONAL "Concepto de factura adicional" field (datalist-backed against
  the business's list, auto-adds a typed custom value to that list on
  submit). The invoice's stored `service_name` is
  `Servicio\nConcepto adicional` when a concept was added, else just the
  service name. The service name itself is NEVER auto-added to the
  concepts list — confirmed explicitly, only the extra concept is
  (`createAndSendInvoice`'s `extraConcept` param, kept separate from the
  combined `concept` param that becomes the stored value).
- Still single line item per invoice (see `backlog.md`'s parked
  multi-line-invoices entry — that's a bigger, separate schema change,
  deliberately not bundled into this one).
- facturas-page's Servicio filter and dropdown options key off the first
  line only (`serviceLine()` helper, splits on `\n`) so an additional
  concept never shows up as a spurious distinct "service" in that filter
  — see that step below for the rest of the Facturas-page filtering.

## Step: facturas-page
Status: in_progress
Criteria:
- RENAMED + EXPANDED (2026-10-15, fifth pass) from this file's earlier, simpler invoice-history-view — Arun asked for real filtering and a resend action, not just a read-only list. Panel placement: new `/panel/invoices` (or `/panel/facturas` — exact route TBD, label "Facturas" in the sidebar either way) route, fills the nav slot post-mvp-menu-items.md's invoices-page step already tracked as superseded/absorbed into this file; mark that step accordingly once this lands.
- Lists every invoice for the business: invoice_number, client_name, service_name, payment_method, amount, sent_at, with a download link (generate-on-request PDF route, same `?token=` link shape as the emailed one — per kalendar-invoices-schema's `access_token` and in-app-pdf-generation's decision; the owner is already authorized by seeing the row in their own page at all, no separate owner-only auth path needed).
- FILTERS, per Arun ("filter through date, type, patient name... actually both, services and payment method, and also invoice number"): date range (on `created_at`/`sent_at`), service (`service_name`), payment method (`payment_method` — cash/card/bono), patient name (`client_name`, text search), and invoice number (`invoice_number`, text search). All client-side over the business's already-loaded invoice list is likely sufficient at MVP scale (mirrors bonos.md's bono-usage-report's client-side filter/sort pattern) — revisit with server-side filtering only if invoice volume ever makes that genuinely necessary.
- ADDED (2026-10, same session as invoice-concepts-list): a free-text
  search box matching across the whole invoice record (client name/email,
  service + additional concept, invoice number, payment method, amount)
  — on top of, not instead of, the five per-field filters above.
- RESEND ACTION, per Arun ("the invoice can have send email feature"): a "Reenviar" action per row, reusing send-invoice-action's underlying email step (NOT allocating a new invoice number or creating a new row — same invoice, same number, just re-sent). Updates `sent_at` to the new send time (last-sent, not first-sent, since a resend is itself a real send event worth reflecting).
- SHARED MISSING-EMAIL HANDLING (same mechanism as invoice-on-payment-trigger's, not a second implementation): if an invoice's `client_email` is empty/a placeholder (can happen for an older row, or one whose booking never had a real email), clicking "Reenviar" prompts inline for an email before sending — entered email updates `kalendar_clients` (when the invoice's booking has a `clinic_client_id` link) AND this invoice row's own `client_email`, so both the client's profile and this specific invoice's email are corrected going forward. The SAME prompt now also exists on the Factura section's "Reenviar" in the booking detail modal (`booking-detail-modal.tsx`) — not a second implementation, one `hasRealEmail` check shared by both entry points.
- SHARED ALTERNATE-EMAIL OVERRIDE (per invoice-on-payment-trigger's identically-named note): "Reenviar" also offers the same one-off "¿Enviar a otro email?" field regardless of whether `client_email` is already set — sends this one resend to a different address (e.g. an accountant) without touching the client's saved profile or this invoice row's own stored `client_email`.
- No edit/void/re-issue actions in this pass — a wrong invoice (wrong amount, wrong service, etc.) is still handled manually/offline, unchanged from the earlier version's explicit design decision. Resend is the only per-invoice action beyond viewing/downloading.

## Step: facturas-pending-tab
Status: in_progress
Criteria (2026-10, Arun — from Bea's "send it to me afterward" feedback;
written up here now, was previously undocumented despite being built):
- A paid booking with no invoice yet (the post-Cobrar Sí/No prompt was
  declined, or it predates this feature) doesn't just disappear — it
  sits in a "Pendientes" tab on the Facturas page
  (`getPendingInvoiceBookings`, `lib/invoices/data.ts`) until generated.
  "No" at Cobrar time means "later," not "never."
- Includes bono-paid sessions (Arun's explicit call) — the bono purchase
  itself getting its own invoice is a separate, not-yet-built feature.
- Same generate-invoice entry point also added directly to a client's own
  booking history on their client-detail page ("Generar factura"/
  "Descargar factura" per paid row) — both this tab and the client page
  share one `InvoiceConfirmModal` component
  (`components/panel/invoice-confirm-modal.tsx`), not two separate
  implementations of the DNI/address/email/concept logic.
- A separate "Factura" section (Descargar/Reenviar, own missing-email
  prompt) was also added to the booking detail modal itself
  (`booking-detail-modal.tsx`) once an invoice exists for that booking —
  not a Pendientes-tab feature exactly, but the same "generate/view an
  invoice without leaving wherever you are" goal, built in the same pass.

## Step: invoice-qr-verification
Status: in_progress
Criteria (2026-10-25, Arun — "I want to develop this", from an uploaded
spec-invoice-qr.md handoff doc; code implemented + typechecked/linted/built
same session, PENDING MANUAL/LIVE TESTING):
- SCOPE: a pre-VeriFACTU public verification QR on every invoice PDF —
  explicitly NOT VeriFACTU itself (no hash chain, no AEAT submission, no
  clinic-side VeriFACTU toggle — see `verifactu-compliance.md`, which
  remains not_started and still blocked on its own
  `verifactu-scope-and-regulation-check` step). This step only lays
  groundwork compatible with that later work: the QR embed code and PDF
  placement never change when VeriFACTU lands, only the URL fed into it
  does (gated on a future `kalendar_businesses.verifactu_enabled` flag,
  not yet built).
- Schema: `kalendar_invoices.verification_url` (nullable text,
  `supabase/schema_subset_030.sql` + folded into `schema_001.sql`) — set
  at generation time so a re-download/re-send reproduces the exact same
  QR. A legacy invoice with no stored value computes it on the fly in
  `lib/invoices/render.ts` instead of requiring a backfill.
- `lib/invoices/qr.ts` — `buildVerificationUrl(invoiceId)` (always the
  Kalendar-hosted page for now) and `generateQrDataUri(url)` (`qrcode`
  npm package, already a dependency for the booking-page QR — PNG data
  URI, embeds directly as a react-pdf `<Image>`, same pattern the
  signature image already uses).
- `createInvoiceForBooking` (lib/invoices/data.ts) now pre-generates the
  invoice's `id` via `randomUUID()` (instead of leaving it to the column
  default) so `verification_url` can be computed and stored in the same
  insert, no second UPDATE round trip.
- REVISED (2026-10-25, same session, Arun): placement/size matched to
  VeriFactu's own QR rules (Royal Decree 1007/2023 / Order HAC/1177/2024
  — Arun-supplied summary, NOT independently confirmed against the actual
  regulation text, which `verifactu-compliance.md`'s still-not-started
  `verifactu-scope-and-regulation-check` step is the place to do before
  anything VeriFactu-specific is built) — top-left, right after the
  header row and before the itemized table, ~35mm square (99pt), with a
  proper quiet zone (`generateQrDataUri`'s `margin: 4`). Used
  UNCONDITIONALLY — VeriFactu-enabled or not — specifically so the PDF
  layout never has to move again once real VeriFactu lands; only the
  URL/caption text would change then. Caption stays "Verificar factura" +
  our own URL, deliberately NOT the regulation's required "VERI\*FACTU"/
  AEAT wording — using that text now would be a false compliance claim,
  since this QR isn't AEAT-verifiable yet.
- Public, no-auth surfaces, both new:
  - `GET /api/invoice/verify/[id]` — JSON with ONLY non-personal fields
    (invoice number, issue date, issuer NIF/name, total, currency,
    status) — no client name/DNI/address/email, no booking id. Built
    entirely from the invoice row's own frozen `business_snapshot`, never
    a live join to `kalendar_businesses` — consistent with this file's
    "frozen at generation" invoice model.
  - `/invoice/verify/[id]` — the page the QR actually opens, styled like
    the existing `/bookings/cancel/[token]` public page (centered card,
    Logo, Icon). Calls `getInvoiceById` directly rather than round-
    tripping through its own API route (that route exists for external
    callers, not for this page to hit itself). Neither route needs a
    `proxy.ts` exemption — `/invoice` and `/api/invoice` were never
    inside its `/panel`/`/patient` auth gates to begin with.
- NOT changed: `access_token`-gated `/api/invoices/[id]/pdf` (the actual
  PDF download/email link) — the QR/verify page is a separate, public,
  deliberately lower-detail surface, not a replacement for it.
- Still needs: Arun to generate a real invoice, scan the QR on an actual
  phone (iOS + Android per the spec's testing checklist), confirm the
  verify page opens with no login and shows correct non-personal fields,
  confirm `verification_url` is stored on the row, confirm re-downloading
  the same invoice reproduces the identical QR, and confirm the
  generate-on-request flow still works for an invoice created before this
  column existed (the legacy-row fallback path). Flip to `done` once
  confirmed.

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
- OUT OF SCOPE for this pass, confirmed explicitly by the spec (not oversights): ~~automatic invoicing on booking completion (stays manual/deliberate for MVP)~~ REVERSED (2026-10-15, fifth pass) — auto-invoicing-on-payment is now explicitly IN scope, opt-in via auto-invoice-setting, see invoice-on-payment-trigger; editing/voiding/re-issuing a sent invoice (still out); multi-line-item/itemized invoices (still out — v1 is strictly one invoice per one booking).
- Testing checklist for whoever builds this (not itself a step, but should gate calling send-invoice-action/sequential-numbering-allocation done): send a real test invoice and confirm email + PDF content match (compare against the real podóloga example's layout where applicable); send two invoices same session same business, confirm sequential no-gap numbering; simulate an email-send failure and confirm the number is still allocated, a clear retryable error is shown, and retry reuses the same row rather than allocating a new number; confirm two different businesses' "first" invoices both correctly get 0001 (per-business scoping, not global); confirm the PDF route renders correctly on repeated requests for the same invoice (byte-identical content, since it's regenerated each time — not literally byte-identical as a PDF file, since renderers aren't always deterministic at that level, but identical in displayed content); confirm the `?token=` link actually restricts to that one invoice (wrong/missing token correctly rejected, not just ignored); confirm Cobrar with auto-invoice OFF shows the Sí/No modal and only creates an invoice on Sí; confirm Cobrar with auto-invoice ON creates+sends with no modal; confirm correcting a payment via Editar never creates a second invoice for the same booking, with either setting; confirm the missing-email inline prompt (both from Cobrar and from facturas-page's Reenviar) correctly saves the entered email to the client's profile; confirm facturas-page's five filters (date, service, payment method, patient name, invoice number) each narrow the list correctly, including in combination.
- ARCHITECTURE CHANGE SUMMARY (2026-10-15, Arun, first pass): dropped the separate stanize/kaminolabs-pdfs portal entirely in favor of in-app `@react-pdf/renderer` generation. Per-clinic template CUSTOMIZATION (admin-template-editor, previously ruled fully out of scope) is still out of scope, but template SELECTION among a small, code-defined set is now explicitly in scope from the start (invoice-template-selection), a new distinction this pass introduces — selecting a premade template is not the same as customizing one.
- ARCHITECTURE CHANGE SUMMARY (2026-10-15, Arun, SECOND pass, same day — "i am thinking that the pdf will be generated upon request"): dropped the first pass's Supabase Storage / `pdf_url` plan entirely too — generate-on-request instead of generate-once-and-store. No bucket, no upload step, no stored file at all; every PDF view (owner's history-view download, client's emailed link) renders fresh from the kalendar_invoices row + the business's current settings. Simpler architecture, one trade-off accepted (template-layout drift on old invoices if a template's design changes later — see in-app-pdf-generation), and one new open question raised (client-facing link auth, since there's no file URL to just hand out anymore — see send-invoice-action).
- Per Arun's explicit instruction (2026-10-15): this is a KNOWN, EXPLICIT choice (link in the email, not an attachment) — generating once per email send to attach would reintroduce a second rendering context that generate-on-request was meant to avoid; emailing a link keeps exactly one PDF-rendering code path (the route handler) for both the owner's history view and the client's email.
- SCOPE EXPANSION (2026-10-15, Arun, FIFTH pass, same day): invoice creation is now wired directly into the Cobrar payment flow (invoice-on-payment-trigger) rather than being a fully separate, manually-triggered action — "the invoice should be generated when an appointment is marked as paid." Adds an opt-in `auto_invoice_enabled` setting (auto-invoice-setting), a one-invoice-per-booking rule that survives later corrections via Editar, and expands the former invoice-history-view into a full filterable facturas-page with a resend action and shared missing-client-email handling. This is the largest scope addition since the original spec — reflected across invoice-on-payment-trigger, auto-invoice-setting, kalendar-invoices-schema's new `payment_method` column, and facturas-page.
- RESOLVED (2026-10-15, sixth pass): the no-`clinic_client_id` open question from the fifth pass — backfill a real `kalendar_clients` row at invoice-generation time, per invoice-on-payment-trigger's own note. No open questions remain in this spec as of the sixth pass.
- SCOPE ADDITION (2026-10-15, Arun, SIXTH pass, same day): alternate-email-at-send-time, a one-off override distinct from (and not replacing) the missing-email-saves-to-profile flow — see invoice-on-payment-trigger and facturas-page's matching notes.
- SEVENTH PASS (2026-10-15, same day, Arun — "start building now"): CODE IMPLEMENTED for every step except legal-requirements-check (already done) and pdf-portal-api-dependency (superseded, intentionally not built) — see the top-of-file note for the file-by-file summary. A few build-time implementation choices worth flagging, not separately confirmed with Arun:
  - `allocate_invoice_number` uses a Postgres function with `pg_advisory_xact_lock` (keyed by business_id+year) rather than a separate counter table — an implementation-detail choice per sequential-numbering-allocation's own "decide once against existing conventions" note, since no prior per-business-sequence pattern existed in this codebase to match.
  - The post-Cobrar invoice confirm modal uses ONE shared email input whose label switches between "¿Enviar a otro email?" (has a real email already) and the required missing-email prompt (doesn't) — one UI field serving both of invoice-on-payment-trigger's two distinct cases, rather than two separate inputs.
  - One-invoice-per-booking is enforced at the application layer (a check-then-insert in `createInvoiceForBooking`/the Cobrar handler), not a DB unique constraint on `booking_id` alone — a genuinely concurrent double-click race is theoretically possible but not guarded against at the DB level; judged low-risk enough not to block this pass, flag if it ever actually happens.
  - MIGRATION NOT YET RUN against the live DB — Arun still needs to run `schema_subset_023.sql`, per this repo's convention (Claude creates the file but doesn't execute live DDL).
