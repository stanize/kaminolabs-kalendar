# Kalendar — Legal drafts: notes for the reviewing lawyer and for Arun

> **DRAFT. NOT LEGAL ADVICE.** The documents in this folder are a first working draft
> prepared with an AI assistant. They must be reviewed and finalised by a Spanish lawyer
> (abogado/a especialista en protección de datos y contratación) before anything is
> published or offered to clinics for signature. Nothing here has been legally validated.

Contents of this folder:

| File | What it is |
|---|---|
| `01-politica-privacidad.es.md` | Privacy policy (authoritative, Spanish) + Annex: cookie notice |
| `01-privacy-policy.en.md` | Courtesy translation |
| `02-terminos-condiciones.es.md` | Terms of use (authoritative, Spanish) |
| `02-terms-and-conditions.en.md` | Courtesy translation |
| `03-contrato-encargado-tratamiento.es.md` | Art. 28 GDPR processor agreement (DPA), Spanish only |
| `00-review-notes.md` | This file: findings from the code, decisions, facts to verify, outside obligations |

Placeholders: `[FILL]` = company fact I do not have. `[VERIFY]` = vendor/product fact to confirm.
`[DECIDIR]` = a business or legal choice that is yours (the draft contains my proposal).
`[ABOGADO]` = a point where I want the lawyer's explicit judgement.

---

## 0. Where I disagree with, or sharpen, the brief (read first)

1. **Free-text fields already exist that can hold clinical content.** I read the schema:
   - `kalendar_bookings.notes` — free-text comment typed by the patient/guest at booking.
   - `kalendar_client_notes.body` — a running history of *private clinic notes per client*
     (clinic-only, timestamped, editable). In a physio/psychology/nutrition clinic this will
     in practice become a clinical diary. That is the single biggest Art. 9 RGPD exposure.
   - `kalendar_support_tickets.description` + attachments (clinic → Kalendar; may contain screenshots with patient data).
   - Service names/descriptions (e.g. "Terapia de ansiedad") also reveal health data once tied to a person.

   **My recommendation:** (a) forbid clinical/diagnostic content in the patient-facing booking
   comment and put a visible hint under the field; (b) in the clinic private notes, forbid
   diagnoses, treatment records and any "historia clínica" content in the Terms and add the same
   hint in the UI; (c) say plainly in the Terms that Kalendar is **not** a clinical-record
   system (Ley 41/2002, art. 14-17 duties stay with the clinic's own system). A contractual ban
   does not remove the risk — the *fact of the appointment* with a psychologist is already health
   data — so the DPA and the privacy policy are written as if Art. 9 data **is** processed, and the
   security level is set accordingly. The ban only reduces the depth of the exposure.
   Product work implied: UI hint texts, optionally a length cap on notes. See Decisions D1.
2. **Role of Kalendar for the patient-portal account is not purely "processor".** A patient who
   creates a portal account gets one login that shows bookings **across all clinics** (history is
   linked globally by verified email: `claimExistingClientHistory`). That cross-clinic view is a
   Kalendar feature, decided and operated by Kalendar. I therefore propose: **Kalendar = controller
   for the portal account and the cross-clinic view; each clinic = controller for its own booking
   records, Kalendar = processor.** The lawyer must decide whether this creates joint controllership
   (Art. 26 RGPD) for the booking records shown in the portal. See `[ABOGADO]` in the privacy policy §2.
3. **Hosting region is probably NOT all-EU.** `vercel.json` is `{}` — no `regions` pinned, so Vercel
   functions run in its default region (historically `iad1`, Washington D.C.) while Supabase is in
   Frankfurt (pooler host `aws-1-eu-central-1`, which is consistent with the brief). If functions run in the
   US, every patient record transits and is processed in the US. That is a transfer to Vercel Inc.
   (needs DPF/SCCs) and it also hurts latency. **Pin function regions to an EU region** (e.g. `fra1`)
   and confirm with the Vercel project settings. The drafts currently describe the position as
   "[VERIFY]" and list US-region processing as a transfer.
4. **Vercel Hobby / Supabase free plan.** `workflows/security-performance-audit.md` notes the project is on
   Vercel Hobby (non-commercial use only under Vercel's terms, as far as known) and probably the Supabase
   free plan (limited backups, project pausing). A paying-clinic SaaS cannot run on Hobby, and the Art. 32
   security statement and the DPA's availability/backup promises depend on the real plan. [VERIFY]
5. **Raw IP addresses are stored.** `kalendar_rate_limit_hits.ip_key` stores the client IP from
   `x-forwarded-for` (not hashed, per `lib/rate-limit.ts`), and `kalendar_error_log.context` can include
   IPs, booking ids and `request_url`. IPs are personal data. Retention is not implemented anywhere today
   (no purge job found). Recommendation below in §3 (retention) — it needs a small engineering task.
6. **RLS is not a security backstop today.** Policies in `schema_001.sql` are `using (true)` and access uses the
   service-role key (as `CLAUDE.md` says: the app-level check is the *only* boundary). I did **not** claim RLS
   protection in any document. If you want to claim "technical segregation between clinics", it rests on
   application code only — the lawyer/ gestor should know this when Annex II of the DPA is signed.
7. **No cookie banner needed on the stated facts** (see §4) — but only if the facts below hold, in particular that
   `kalendar_locale` is set only when the user picks a language and that no third-party scripts/embeds load.
   Fonts use `next/font/google`, which self-hosts the font files at build time (no browser call to Google) — good, `[VERIFY]` in the built output.
8. **Consumer-protection angle.** Clinics are professionals (B2B). Patients are consumers *towards the clinic*, and also
   towards Kalendar when they open a free portal account. The Terms therefore have a clinic part and a short
   patient/client part. P2B Regulation (UE) 2019/1150 and the Data Act (Reg. (UE) 2023/2854, switching between data
   processing services) may apply to Kalendar as a SaaS/intermediation service; I wrote the notice and
   termination clauses conservatively to fit them. `[ABOGADO]`

---

## 1. Decisions for a human

| # | Decision | My proposal (in the drafts) | Where |
|---|---|---|---|
| D1 | Prohibit or allow clinical content in free-text fields (booking comment, client notes, support tickets)? | Prohibit in patient booking comment and clinic notes; Kalendar is not a clinical-record system. Needs UI hints. | Terms §6; DPA §4; Privacy §3 |
| D2 | Legal basis for clinics' processing of booking data of health professions: Art. 9(2)(h) + 9(3) (healthcare provision under professional secrecy) vs explicit consent 9(2)(a). | Clinic-side basis is the clinic's decision; draft names (h) as the primary basis and consent as fallback. Kalendar cannot choose it for the clinic. | Privacy §4; Terms §5 |
| D3 | Controller/processor split for the patient portal and the cross-clinic view (joint controllership?). | Kalendar controller of portal account + aggregated view; clinic controller of booking records. | Privacy §2 |
| D4 | DPO: appoint or not. | Not appointed now; document the assessment. Art. 37.1(c) RGPD ("large scale" special categories as *core activity*) could apply once volume grows. LOPDGDD art. 34 does not list SaaS providers. Re-assess at a threshold. | Privacy §1 |
| D5 | Breach-notification deadline to clinics. | "Without undue delay and in any case within 48 h" (Art. 33(2) says undue delay; the clinic has 72 h). Is 48 h operationally realistic for a solo founder? | DPA §9 |
| D6 | Retention of booking/patient data while the clinic is active. | Clinic controls; Kalendar keeps while the account is active; optional automatic anonymisation of clients with no activity for 24 months (off by default, product change). | Privacy §8; DPA §12 |
| D7 | Data at contract end. | 30 days export window (read-only), then deletion; backups overwritten within [35] days [VERIFY Supabase]. Billing records kept 6 years. | DPA §12; Terms §12 |
| D8 | Cascade deletion warning. Deleting a clinic account deletes its patients' booking records (and the patient's portal history for that clinic). | Terms warn and force a prior-export step; consider notifying portal patients. Clinic must keep its own clinical records elsewhere. | Terms §12 |
| D9 | Error-log retention. | debug/info 30 days; warning/error 90 days; critical 12 months; rate-limit IPs 30 days; nothing with patient name/email/phone in `context`. Needs a scheduled purge job. | Privacy §8 |
| D10 | Minimum age for patient portal accounts. | 18 (conservative). Spanish baseline for data consent is 14 (LOPDGDD art. 7), health decisions 16 (Ley 41/2002 art. 9.3). Booking for a minor only by parent/guardian. | Privacy §11; Terms §10 |
| D11 | WhatsApp: are Twilio and Meta Kalendar sub-processors or the clinic's own providers? | The clinic contracts Twilio with its own credentials; so they are the clinic's providers that Kalendar connects to on the clinic's instruction. Listed in DPA Annex III as "clinic-appointed", with Kalendar still responsible for its own part (Art. 28(4) analogy). | DPA §6 + Annex III |
| D12 | Liability cap amount (clinic Terms). | Greater of 12 months' fees and €[FILL]; **in the free period the fee is zero, so the cap must not be "fees paid" alone**. Pick a floor. | Terms §14 |
| D13 | Governing law/courts. | Spanish law; courts of [FILL city]. Consumer-patients keep their home forum (art. 90.2 / 54 TRLGDCU etc.; cannot be waived). | Terms §17 |
| D14 | Free period mechanics: what happens after 6 months without a payment method? | Draft: no auto-charge without prior notice; clinic must add a payment method; service downgrades/suspends after notice. Match Stripe configuration (`trialing` status exists). | Terms §9 |
| D15 | Sending commercial emails to clinics (newsletters/product news). | Not included; transactional/service emails only. If you want marketing: separate consent/LSSI art. 21 mechanism. | Privacy §5 |
| D16 | Will Kalendar use patient data for product analytics or AI features? | No; drafts say patient data is processed only on clinic instruction. `workflows/backlog.md` mentions a possible Gemini feature — if ever built, privacy policy + DPA + sub-processor list must change first. | DPA §3 |
| D17 | Email language. | Guest emails Spanish-only (pinned by `EMAIL_LOCALE`); the policy says so. | Privacy §5 |
| D18 | Email-to-clinic disclaimer text on booking page footer (first layer, LOPDGDD art. 11). | Short first-layer notice proposed in Privacy §0; clinic controller identity must be shown on its booking page — implement. | Privacy §0 |
| D19 | Whether the DPA is signed by click-through. | Yes: versioned acceptance at clinic sign-up + stored evidence. | DPA §1; outside list |
| D20 | Cookie banner. | No banner; informational notice (Annex). | Privacy Annex |

---

## 2. Facts to verify (`[VERIFY]` list) and assumptions

### Company
- Legal entity name, NIF/CIF, registered address, registry data (Registro Mercantil, if a company), contact/privacy email, city for courts. (`LSSI-CE` art. 10 requires name, address, email, NIF and registry data to be shown.)
- DPO decision and the written assessment behind it.

### Infrastructure / vendors
| Item | What to confirm | Why |
|---|---|---|
| Supabase region | Project `rlxfcmijbesoblissmtd`: region really `eu-central-1` (Frankfurt) — pooler host says so; also Storage buckets (`support-attachments`, `business-logos`) in the same project. | Art. 44 transfers; description of storage. |
| Supabase plan | Free vs Pro; backups/PITR; project pausing; DPA acceptance (Supabase publishes a DPA accepted via its terms); Supabase Inc. is US-based → DPF/SCC status. Underlying cloud (AWS) as sub-sub-processor. | Art. 28/32/44. |
| Vercel region | Default function region is probably US; set `regions` in `vercel.json`. Plan (Hobby is non-commercial). Vercel DPA + DPF. Vercel runtime logs retention (also stores our `console.error` output with possible IPs/URLs). | Art. 44, 32. |
| Resend | Account region (US default vs EU), DPA, DPF/SCC status; email content stored by Resend and its retention. Emails contain: patient name, service, date/time, clinic. | Art. 28/44. |
| Stripe | Which Stripe entity contracts with a Spanish business (Stripe Payments Europe Ltd, Ireland, expected); Checkout / Billing Portal (hosted by Stripe) vs embedded Elements; what is stored (`stripe_customer_id`, `stripe_subscription_id`, status only — I saw no card data). Stripe acts as controller for fraud/AML/legal duties. | Art. 6, 13, 44. |
| Twilio | Each clinic uses its own Twilio account/Auth Token; Kalendar stores the Auth Token encrypted (AES-256-GCM, app-layer key `WHATSAPP_CONFIG_ENCRYPTION_KEY`). Messages travel clinic's Twilio ⇄ Meta; Kalendar stores phone number, display name (`ProfileName`) and conversation *state* (service/date/time selected), apparently **not** message text — confirm. Twilio entity/DPF/SCC. | Art. 28, 44. |
| Meta / WhatsApp Business | Meta acts as processor for business-message content but as controller for some metadata/own purposes — confirm against the current WhatsApp Business terms and Data Processing Terms; Meta Platforms Ireland vs Inc.; DPF. Sandbox use must never involve real patients. | Art. 26/28/44. |
| Google OAuth | Only for sign-in (name, email, profile photo?). Which scopes are requested (profile+email only?). Google Ireland as contracting entity. | Art. 6(1)(b), 44. |
| Better Auth | Library running in our own app — **not** listed as a processor in any document. Confirm no hosted Better Auth services are used (no "Better Auth Infrastructure"/dashboard). | — |
| Password hashing | Better Auth default (scrypt) — confirm no override. | Art. 32. |
| Fonts | `next/font/google` self-hosts at build — confirm no request to `fonts.googleapis.com` in the browser. | Cookie/IP leakage to Google. |

### Product facts I relied on
- Session cookie for login (Better Auth cookie names, expiry, flags HttpOnly/Secure/SameSite — confirm); `kalendar_locale` cookie (confirm it is set only on user choice, and its lifetime); `sessionStorage` used by the Zustand store during sign-in (survives the Google OAuth round-trip). No analytics/ads. Does the Stripe checkout flow set cookies on Kalendar's domain? (should not)
- Cancellation window: `kalendar_businesses.cancellation_window_hours` default 24 h (0–720). Inside the window self-cancel is blocked and becomes a request the clinic approves. The cancel link is token-based (`/bookings/cancel/[token]`).
- Reminders at 24 h and 1 h via Resend; guest emails pinned Spanish (`EMAIL_LOCALE`).
- Guest booking confirmed immediately; `clinic_reviewed_at` is a clinic follow-up flag.
- Patient-portal history linking by verified email, global across clinics (`claimExistingClientHistory`).
- Clinic accounts: owner name/email/login via Better Auth; billing details. No payment between patient and clinic is processed ("payment_status/payment_method" fields in bookings are manual marks by the clinic: cash/card/bono — confirm no card data).
- Cascade deletion exists for all `kalendar_*` tables on deleting the user; `kalendar_client_notes` cascades off `kalendar_clients`/`kalendar_businesses`.
- Admin portal (`kaminolabs-kalendar-admin`) lets Kalendar staff access clinic data (tickets, businesses, error log, schema reset in dev phase). Who has access, authentication strength, logging of access. The temporary admin "schema-reset" feature must be gone before real data exists.
- Security measures in DPA Annex II are only those I saw in code: HTTPS (assumed, Vercel), server-side authorization for every mutation (`authedAction`), email-verification gate, rate limiting per IP, encrypted Twilio tokens, service-role key server-only, no payment-card data stored. **Not evidenced and therefore left as `[VERIFY]`/omitted:** MFA, audit log of staff access, backup/restore tests, penetration tests, encryption at rest details, incident-response plan.
- Retention periods are *my proposals*, not current behaviour: no automatic purge exists in the code I read.

### Assumptions I made
- Spanish-only legal text is authoritative; English is courtesy.
- Clinics are professionals/businesses (autónomos or companies), not consumers.
- "Free for 6 months" applies to the first cohort only; the Terms refer to it generically ("periodo de prueba/gratuito").
- Madrid-first does not change the legal regime (all Spain, AEPD competent).
- Kalendar does not sign the clinic's patient-facing legal notices; clinics must add their own privacy information (Art. 13) — the booking page should show it.

---

## 3. Retention proposal (summary)

| Data | Proposed retention |
|---|---|
| Clinic account (owner identity, login) | While the account is active; then blocked (LOPDGDD art. 32) for up to [5] years for claims (art. 1964 Código Civil — `[ABOGADO]`), then deleted |
| Billing/invoices/Stripe ids | 6 years (Código de Comercio art. 30; tax statutes 4 years min.) |
| Patient/client booking data, clinic notes (as processor) | Until the clinic deletes them or the contract ends + 30-day export window; backups ≤ [35] days |
| Patient portal account (Kalendar controller) | While the account exists; deleted on request; inactive 36 months → notice then deletion [DECIDIR] |
| Reminder/transactional email logs at Resend | Per Resend retention [VERIFY]; Kalendar stores only `*_sent_at` timestamps |
| WhatsApp sessions (phone, ProfileName, state) | 30 days after last message [DECIDIR — needs purge job] |
| `kalendar_error_log` | debug/info 30 d; warning/error 90 d; critical 12 m; `resolved` rows 30 d |
| `kalendar_rate_limit_hits` (raw IP) | 30 days, or hash the IP |
| Vercel runtime logs | Vendor default [VERIFY] |
| Support tickets & attachments | 24 months after resolution |

---

## 4. Cookies — is a banner required?

Facts: session cookie (login), `kalendar_locale` (language), `sessionStorage` entry during sign-in. No analytics, no advertising.

Analysis (LSSI-CE art. 22.2; AEPD *Guía sobre el uso de las cookies* (2023/2024 update)):
- **Session cookie**: strictly necessary to provide a service the user requests (login) → exempt from consent; information still advisable.
- **`kalendar_locale`**: AEPD treats user-chosen interface customisation (language) as exempt *if the user sets it themselves* and it is not used for anything else; if it is set by automatic detection before the user acts, the lawyer should decide whether it still fits the exemption. Lifetime should be proportionate (e.g. ≤ 1 year).
- **`sessionStorage`**: same Art. 22.2 regime as cookies ("dispositivos de almacenamiento"); strictly necessary for completing the OAuth sign-in → exempt.
- **Conclusion:** no consent banner required *on these facts*. A short informational cookie notice is recommended (included as Annex to the privacy policy; also usable as `/legal/cookies`). A banner becomes necessary the moment analytics, ads, session replay, embedded third-party widgets (maps, video) or non-essential Stripe/Meta scripts are added. `[ABOGADO]` to confirm the language-cookie point.

---

## 5. Obligations outside these documents (check with a gestor/lawyer)

1. **Registro de actividades de tratamiento (RAT)**, Art. 30 RGPD: one as controller (clinic accounts, portal accounts, billing, support) and one as processor (30.2). The 250-employee exemption (30.5) does not apply (processing is not occasional and may include special categories).
2. **DPIA / EIPD (Art. 35)**: health-adjacent data, new technology (WhatsApp bot), possibly "large scale" later. Check the AEPD list of processing operations requiring a DPIA. As processor you assist clinics (Art. 28(3)(f)); also do a documented screening for your own controller activities. Provide clinics a short DPIA-support sheet.
3. **Breach procedure (Arts. 33–34)**: written playbook, contact tree, 48 h notice to clinics, log of incidents (even those not notified), AEPD notification route for your own controller data (72 h), template messages.
4. **DPA signature flow in the product**: acceptance at clinic sign-up (checkbox, not pre-ticked) with versioned text, timestamp, user id, IP stored in a new table (e.g. `kalendar_legal_acceptances`); re-acceptance when version changes; downloadable PDF copy; Art. 28(9) allows electronic form. Same for ToS/privacy acceptance by patients at portal sign-up.
5. **LSSI-CE**: art. 10 identity information on the site (name, address, email, NIF, registry data); art. 27 pre-contract information and confirmation for online contracting (clinic subscription); art. 21 (no commercial emails without prior consent — reminder emails are service emails, but do not add marketing to them); art. 22.2 cookies (see §4).
6. **Sub-processor change process**: a public sub-processors page and a notification mechanism (email to clinics) matching DPA §6.
7. **International-transfer documentation**: keep copies of vendor DPAs and DPF/SCC evidence; transfer impact assessment (TIA) where SCCs are used (US vendors without DPF certification).
8. **Clinic-side duties you should help clinics with**: their own Art. 13 notice, their own RAT, professional-secrecy duties (Ley 41/2002, código deontológico), historia clínica retention (5 years minimum, art. 17 Ley 41/2002 — in their own system, not Kalendar).
9. **Platform regulation**: whether P2B Regulation (UE) 2019/1150 and the Data Act switching rules apply; Ley 7/1998 (condiciones generales) incorporation requirements for click-through terms; consumer terms for the patient portal.
10. **Security hardening before real patient data**: EU function region, paid plans with backups/PITR, MFA for admin, access log for the admin portal, remove dev-only admin schema-reset, purge jobs for logs/rate-limit/WhatsApp sessions, UI hints against clinical content.
11. **Prospecting / demo accounts**: pre-filling demo accounts from clinics' public websites (presales) is itself processing of professionals' data (Art. 14 RGPD information duty, LSSI art. 21 for any outreach). Not covered by these documents.
12. **VeriFactu/invoicing** — out of scope here, as requested.
13. **Insurance / SLA / tax**: professional-liability or cyber insurance; IVA treatment of the subscription (outside this scope).
14. **Citation check**: every article number in the drafts (especially TRLGDCU arts. 10, 82–91, 86, 90.2, 102 ff., 114 ff., 128 ff., 147; Ley 7/1998; LOPDGDD arts. 7, 11, 32, 33, 34; Código Civil 1102/1964/1255) was written from memory and must be checked by the lawyer. The Spanish text refers to the DPA at `/legal/dpa` — that route does not exist yet.
15. **Replace placeholders in `content/legal/*.md`** only after the lawyer signs off; update `workflows/legal-compliance.md` status then (this folder deliberately does not touch the live pages).
