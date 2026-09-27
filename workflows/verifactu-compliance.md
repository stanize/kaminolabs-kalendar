# Workflow: VERI*FACTU Compliance

Spain's anti-fraud invoicing regulation (Ley 11/2021 / Reglamento VERI*FACTU)
requires invoicing software to produce tamper-evident, hash-chained invoice
records, and (for software operating in "VERI*FACTU mode") to submit those
records to the AEAT in near-real-time, with a verifiable QR code on the
invoice itself. This directly extends `pdf-invoicing.md` (clinic → patient
invoicing) — VERI*FACTU applies to whatever software actually emits the
invoice, so this feature only makes sense once that base invoicing feature
exists, and needs to satisfy VERI*FACTU's record-keeping/hash-chain/QR
requirements from the point that base feature is built, not bolted on after.

**Surfaced 2026-09-27 (Arun, late-session, not yet designed):** the plan is
to build this WITH Kalendar's first real client rather than speculatively in
isolation — VERI*FACTU compliance is genuinely valuable as a sales/acquisition
angle ("Spanish clinics need this, most competitors don't have it yet"), but
the exact scope (does Kalendar operate in VERI*FACTU mode itself, or produce
records for the clinic's own separately-VERI*FACTU-compliant software?) is
a real design decision best made against one concrete client's actual
situation, not guessed at generically. This file exists so the intent isn't
lost before that engagement starts — not as a spec to build from yet.

## Step: verifactu-scope-and-regulation-check
Status: not_started
Criteria:
- BLOCKS EVERYTHING ELSE: confirm the CURRENT regulation text and effective
  dates directly (via an accountant/gestor, same pattern as
  `pdf-invoicing.md`'s `legal-requirements-check` step) before any schema or
  code decisions — VERI*FACTU's technical requirements (record format, hash
  chain algorithm, AEAT submission endpoint, QR code content/rendering,
  which software/business sizes are in scope, phased effective dates) are
  regulatory detail that shifts over time and should never be assumed from
  a general-knowledge summary written today. Treat anything below as
  directional framing only, not a confirmed spec.
- Key open scope question, to settle with the first client, not guessed
  here: is Kalendar itself the "computer invoicing system" that must be
  VERI*FACTU-compliant (meaning Kalendar generates the hash-chained
  records, the QR code, and optionally submits to the AEAT on the clinic's
  behalf) — or does the clinic use separate accounting/invoicing software
  for their official tax records, with Kalendar's own invoice PDF being a
  courtesy document to the patient, not the tax-authority-facing one? These
  are very different build scopes and the answer likely depends on how the
  first client currently handles their own accounting.
- Depends on `pdf-invoicing.md` reaching at least `kalendar-invoices-schema`
  + `sequential-numbering-allocation` (both currently not_started) before
  VERI*FACTU-specific fields/hash-chaining can be designed against a real
  schema, rather than a hypothetical one.

## Step: verifactu-hash-chain-and-qr
Status: not_started
Criteria:
- NOT YET DESIGNED — placeholder only. Once scope is settled above, this
  step covers whatever's needed to make each invoice record tamper-evident
  (a hash chain linking each invoice to the previous one, in whatever form
  the confirmed regulation requires) and to render/attach the QR code the
  regulation requires on the invoice document.
- Likely touches: `kalendar_invoices` schema (new columns for the hash
  chain), the PDF-generation payload sent to `stanize/kaminolabs-pdfs`
  (QR code needs to render on the actual PDF), and possibly a new AEAT
  submission integration if Kalendar ends up in VERI*FACTU mode per the
  scope decision above.

## Step: verifactu-as-a-sales-angle
Status: not_started
Criteria:
- Arun's own framing (2026-09-27): this is genuinely useful for acquiring
  new clients, not just a compliance checkbox — Spanish clinics are
  required to deal with this regulation one way or another, and a booking
  platform that already handles it is a real differentiator against
  competitors that don't. Worth reflecting in sales/marketing material
  once built, not just shipped silently.
- Sequencing note: don't oversell "VERI*FACTU-ready" before the scope
  question above is actually settled and built — a half-built claim here
  is a compliance/trust risk given the subject matter (tax authority
  reporting), worse than not mentioning it yet.

## Notes / Deviations
- This file is deliberately thin — it exists to record the intent and the
  key open scope question before the details are forgotten, not to
  pre-design a regulatory feature without the first client's real
  situation in hand. Expect this file to be substantially rewritten once
  that engagement starts.
