> **DRAFT — REMOVE THIS NOTICE BEFORE PUBLISHING.** This is a working draft, **not legal advice**, and will be reviewed by a Spanish lawyer before publication. `[FILL]`, `[VERIFY]`, `[DECIDE]` and `[LAWYER]` mark missing facts or open decisions. **Courtesy translation only — the Spanish version is the authoritative one.**

# Privacy Policy

**Last updated:** [FILL date] · **Version:** 0.1 (draft)

This policy explains which personal data Kalendar by KaminoLabs processes, why, for how long and what rights you have. It is written for three kinds of people: **clinics and professionals** using Kalendar, **patients and clients** who book an appointment, and **website visitors**.

## 0. Summary (layered information, art. 11 LOPDGDD)

| | |
|---|---|
| **Controller** | Depends on who you are (section 2). For clinic accounts and patient portal accounts: [FILL company name], tax ID [FILL]. For your appointment data: the clinic you book with. |
| **Purpose** | Manage accounts, bookings, reminders, subscription and support. |
| **Legal basis** | Contract or pre-contractual steps (art. 6.1.b GDPR), legal obligation (6.1.c), legitimate interest in service security (6.1.f) and, for health data, the art. 9.2 GDPR conditions that apply to the clinic. |
| **Recipients** | Technical providers (hosting, database, email, payments, WhatsApp) and the clinic you book with. Some are in the US with safeguards (section 7). |
| **Rights** | Access, rectification, erasure, objection, restriction, portability and not to be subject to automated decisions, by writing to [FILL email]. You may complain to the AEPD. |
| **More information** | In this policy. |

## 1. Who we are

- **Name:** [FILL company name] ("KaminoLabs", "we"), owner of **Kalendar by KaminoLabs** ("Kalendar").
- **Tax ID:** [FILL] · **Address:** [FILL] · **Registry details:** [FILL if applicable] (art. 10 LSSI-CE).
- **Contact and privacy email:** [FILL]
- **Data Protection Officer (DPO):** [DECIDE] We have not appointed a DPO. We assessed whether one is required (art. 37 GDPR and art. 34 LOPDGDD) and, given current volume and nature, consider it is not [LAWYER: confirm and document]. Privacy queries go to the email above.

## 2. Our role: controller or processor?

Kalendar is a booking platform for professionals. Our role changes depending on the data:

| Data | Who decides the purposes | Our role |
|---|---|---|
| **Clinic account**: owner's name and email, login (password or Google), billing and subscription data, support tickets | KaminoLabs | **Controller** |
| **Patient account (portal)**: email, name, optional phone, login, and the unified view of your bookings across clinics | KaminoLabs | **Controller** [LAWYER: assess joint controllership, art. 26 GDPR, for booking data shown in the portal] |
| **Data of a clinic's patients and clients**: name, email, phone, bookings, services, comments, the clinic's private notes, bono usage, WhatsApp conversation data | The clinic | The **clinic** is controller; KaminoLabs is **processor** and acts only on the clinic's instructions (art. 28 GDPR), under the processor agreement each clinic signs |
| **Website visitors and technical security logs** | KaminoLabs | **Controller** |

If you are a patient or client and want to exercise rights over your appointments, your main contact is **the clinic**; we will help and forward your request to it without delay (section 9).

## 3. What data we process and where it comes from

**3.1 Clinics and professionals (provided by them)**
- Identity and login: name, email, password (stored hashed) or Google identifier, email-verification status.
- Business data: name, type of activity, address, phone and contact email, logo, services, team, hours, holidays and time off, cancellation window.
- Subscription and billing: Stripe customer and subscription identifiers and subscription status. **We do not store card numbers**; Stripe handles them.
- WhatsApp setup (optional): the clinic's own Twilio account SID, WhatsApp number and Auth Token (the latter encrypted).
- Support: subject, description, category and any attachments you send.

**3.2 Patients and clients (provided by them or by the clinic)**
- Name, email and phone; service, professional, date and time of the appointment; optional comment when booking; booking and cancellation status; bono usage and payment marks entered by the clinic (cash/card/bono); private notes the clinic writes about the person; booking language.
- Via WhatsApp: your phone number, your WhatsApp profile name if we receive it, and the state of the booking conversation (service, date and time chosen). [VERIFY: message text is not stored; Twilio may keep its own logs in the clinic's account.]
- Portal account (optional): email, name, phone, login. If you create an account with a verified email, we link to it the earlier bookings made with that same email at any Kalendar clinic, so you see your full history.

**3.3 Health data — please read**
Kalendar is **not a clinical-record system** and is not designed to store diagnoses or treatments. Even so, the mere fact that you book with a physiotherapist, psychologist or nutritionist can reveal health information, so we treat it with reinforced measures, as if it were a special category of data (art. 9 GDPR).
- **Do not write clinical data** (symptoms, diagnoses, medication, detailed reason for consultation) in the booking comment. If you need to tell your professional something, do it at the appointment.
- We forbid clinics from using Kalendar to store medical records or diagnoses (see Terms of Use). [DECIDE D1]

**3.4 Visitors and technical data**
- IP address, date and time, requested URL, browser type and technical errors, in security and operations logs and in the per-IP booking limit used against abuse.
- Cookies and browser storage: see the Annex (cookies).

We use no analytics or advertising data. We do not sell data. We take no automated decisions with legal effects on you.

## 4. What we use data for and on what legal basis

| Purpose | Legal basis |
|---|---|
| Create and maintain the clinic account and provide the service | Contract (art. 6.1.b GDPR) |
| Charge and manage the subscription; invoicing and tax/commercial obligations | Contract (6.1.b) and legal obligation (6.1.c; Commercial Code art. 30; tax law) |
| Create and maintain the patient account and show your history | Contract (6.1.b) |
| Manage bookings, confirmations, cancellations and reminders 24 h and 1 h before the appointment, by email and, if the clinic enables it, WhatsApp | For the clinic: performance of the service you request (6.1.b). We act on its behalf as processor |
| Processing of health data that may be inferred from bookings | Decided by the clinic: normally art. 9.2.h GDPR (healthcare, under professional secrecy, art. 9.3) and, if it chooses, explicit consent 9.2.a. [DECIDE D2; LAWYER] |
| Support and handling enquiries | Contract (6.1.b) / legitimate interest (6.1.f) |
| Security, abuse prevention and error diagnosis (logs, per-IP limit) | Legitimate interest (6.1.f) in keeping the platform secure and reliable |
| Verify email and recover passwords | Contract (6.1.b) and security (6.1.f) |
| Service communications (change, security and billing notices) | Contract (6.1.b) and legal obligation |
| Handling claims and defending rights | Legitimate interest (6.1.f) |

We send no commercial communications without your prior consent (art. 21 LSSI-CE). [DECIDE D15]

## 5. Emails and messages we send

- Booking confirmation, cancellation and reminders (24 h and 1 h before), and notices to the clinic of new bookings.
- Email verification and password recovery.
- A notice to the owner if their booking page address changes.
- Emails addressed to patients and clients are **currently sent in Spanish only**, whatever language you used to book.

## 6. Who receives your data

**The clinic** you book with sees your appointment data. **Our providers** process data on our (or the clinic's) behalf under contract (art. 28 GDPR):

| Provider | Purpose | Data | Location / transfer |
|---|---|---|---|
| **Supabase** (database and files) | Store all Kalendar data | All data in section 3 | EU Central region (Frankfurt) [VERIFY]. Supabase Inc. is a US company: [VERIFY mechanism] |
| **Vercel** (hosting and execution) | Serve the site and run the application | All, in transit and in technical logs | Execution region [VERIFY; may currently be the US]. US: EU-US Data Privacy Framework (DPF) or standard contractual clauses (SCCs) [VERIFY] |
| **Resend** (transactional email) | Send confirmations, reminders and verifications | Email, name, appointment data | [VERIFY region]; US: DPF/SCCs [VERIFY] |
| **Stripe** (clinic subscription payments) | Charge the subscription | The owner's billing data. Never patient data | Stripe Payments Europe Ltd. (Ireland) [VERIFY]; US transfers: DPF/SCCs [VERIFY]. Stripe is also an independent controller for fraud and legal duties |
| **Twilio** and **Meta (WhatsApp Business)** | WhatsApp bookings and messages if the clinic enables them. The clinic contracts Twilio with its own credentials | Phone, profile name, conversation state | US: DPF/SCCs [VERIFY]. Meta may process metadata as an independent controller [VERIFY] |
| **Google** (sign-in) | Optional Google sign-in | Name, email and profile photo from the Google account | Google Ireland / Google LLC: DPF/SCCs [VERIFY] |

For sign-in we use the open-source library *Better Auth*, which runs inside our own application; it is not a third party receiving your data.

We may disclose data to authorities, judges or courts where legally required. We do not sell or transfer data for advertising.

## 7. International transfers

Our database is in the EU. Some providers are US companies or may process data there. When that happens we rely on the **adequacy decision for the EU-US Data Privacy Framework** (art. 45 GDPR) if the provider is certified, and on the European Commission's **standard contractual clauses** with supplementary measures otherwise (art. 46 GDPR). You can ask for a copy of the safeguards at [FILL email]. [VERIFY for each provider]

## 8. How long we keep data

| Data | Period |
|---|---|
| Clinic account | While the account is active; then blocked for up to [5] years for possible claims and deleted (art. 32 LOPDGDD) [LAWYER] |
| Billing and subscription | 6 years (Commercial Code art. 30 and tax law) |
| Patient and client data (processed on behalf of the clinic) | Decided by the clinic. If the clinic closes its account it has 30 days to export and the data is then deleted; backups are overwritten within [35] days at most [DECIDE D6/D7; VERIFY] |
| Patient portal account | While it exists. You can delete it at any time. Accounts inactive for more than [36] months: prior notice and removal [DECIDE] |
| WhatsApp conversation sessions | [30] days after the last message [DECIDE; needs engineering work] |
| Error and event log (may include business ID, URL and IP) | Debug/info 30 days; warnings and errors 90 days; critical incidents 12 months [DECIDE D9] |
| Per-IP anti-abuse counter | 30 days [DECIDE] |
| Support tickets and attachments | 24 months after resolution |

If a clinic deletes its account, **the data of its patients and clients stored in Kalendar is deleted as well**, including their trace in the portal history. The clinic is responsible for keeping its own clinical records and files as the law requires (for example, art. 17 of Law 41/2002) outside Kalendar.

## 9. Your rights and how to exercise them

You have the right to **access** your data, have it **rectified** or **erased**, to **object**, to request **restriction** and **portability**, and to withdraw consent where it is the basis (arts. 15–22 GDPR; arts. 12–18 LOPDGDD).

- **Clinic or portal account data:** write to [FILL email] from your account email. We reply within one month at most (art. 12.3 GDPR). You can delete your portal account from the portal itself [VERIFY this feature exists].
- **Data about your appointments at a clinic:** contact the clinic. If you write to us, we will forward your request to the clinic within [5] working days and help it respond.
- We may ask you to prove your identity.

**Complaints:** if you believe your rights have not been respected, you may complain to the **Spanish Data Protection Agency (AEPD)** (www.aepd.es; C/ Jorge Juan, 6, 28001 Madrid), without prejudice to contacting us first.

## 10. Security measures (art. 32 GDPR)

Among others: encrypted connections (HTTPS); server-side access control on every operation so each clinic accesses only its own data; email verification; application-level encryption of Twilio credentials; per-IP booking limits against abuse; separation of server and browser keys; and error logging. We do not store card data. [VERIFY the rest: backups, encryption at rest, two-factor for administration, staff access logging.] No system is infallible. If a security breach affects you, we will notify the clinic without delay (and you where art. 34 GDPR requires it).

## 11. Minors

Kalendar is not aimed at minors. Portal accounts are only for people aged [18] or over [DECIDE D10]. If you book for a minor (for example a child physiotherapy session or tutoring), you must be their parent or legal guardian and the clinic processes the minor's data under its responsibility. In Spain a minor's own consent to data processing is valid from age 14 (art. 7 LOPDGDD), and Law 41/2002 sets the ages for health decisions. If we detect an unauthorised minor's data, we will delete it.

## 12. Changes to this policy

We may update it. If a change is significant, we will email clinics at least [15] days in advance and publish the new date and version here. We keep earlier versions.

---

## Annex — Cookie and local-storage notice

We use only **technical, necessary** items, so we do not ask for consent (art. 22.2 LSSI-CE) and show no banner. We use no analytics, advertising or tracking cookies.

| Name | Purpose | Duration | Type |
|---|---|---|---|
| Better Auth session cookie [VERIFY name] | Keep you signed in | [VERIFY; session/days] | First-party, technical |
| `kalendar_locale` | Remember the language you chose (es/en) | [VERIFY; ≤ 1 year] | First-party, user-chosen personalisation |
| Browser `sessionStorage` | Keep your progress during sign-in (including the Google redirect). Cleared when you close the tab | Tab | First-party, technical |

If, when paying or signing in, we redirect you to Stripe or Google, those services may use their own cookies under their own policies. You can delete or block cookies in your browser; sign-in will stop working. We will notify you and ask for consent before using any non-essential cookie.
