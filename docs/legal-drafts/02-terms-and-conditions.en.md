> **DRAFT — REMOVE THIS NOTICE BEFORE PUBLISHING.** This is a working draft, **not legal advice**, and will be reviewed by a Spanish lawyer before publication. `[FILL]`, `[VERIFY]`, `[DECIDE]` and `[LAWYER]` mark missing facts or open decisions. **Courtesy translation only — the Spanish version is the authoritative one.**

# Terms and Conditions of Use

**Last updated:** [FILL date] · **Version:** 0.1 (draft)

## 1. Who we are and acceptance

Kalendar by KaminoLabs ("Kalendar") is a service of [FILL company name], tax ID [FILL], address [FILL], email [FILL] and, where applicable, registered in the Commercial Registry of [FILL] (art. 10 LSSI-CE). Below, "KaminoLabs" or "we".

These Terms govern use of Kalendar by:
- **Clinics and professionals** who create an account to manage their calendar ("the Clinic" or "you" in the parts addressed to them); and
- **Patients and clients** who book an appointment or create a portal account ("the Patient"), as far as it concerns them (section 10).

By creating an account, ticking the acceptance box or using the service you accept these Terms, the [Privacy Policy](/legal/privacy) and, if you are a Clinic, the [Data Processing Agreement](/legal/dpa) [VERIFY path]. We keep a record of acceptance (date, version and account). If you disagree, do not use the service.

## 2. The service

Kalendar is an online booking platform (SaaS) for independent professionals and small clinics in Spain (physiotherapy, psychology, nutrition, beauty, fitness, coaching, tutoring and similar). Depending on the plan, it includes:
- Clinic sign-up with Google or email and password, and email verification;
- setup of services, team, hours, holidays and time off, and a public booking page;
- patient bookings as guests (name, email, phone) or with a portal account where they view history and cancel;
- email reminders 24 h and 1 h before appointments;
- WhatsApp bookings, using each Clinic's Twilio credentials and Meta's WhatsApp Business API;
- bonos (session packages) and usage tracking;
- cancellation handling within the window the Clinic configures;
- support.

Kalendar does **not** process payments between Patient and Clinic: payment marks (cash, card, bono) are the Clinic's internal notes. Nor does it issue the Clinic's invoices to its patients. [Future features may need additional terms.]

## 3. Account and eligibility (Clinics)

3.1 Only **professionals and businesses acting within their professional activity**, aged 18 or over and with legal capacity, may register. By registering you declare the data is true and that you can bind the Clinic.
3.2 You are responsible for your credentials and all activity on your account. Tell us promptly if you suspect unauthorised access.
3.3 Email-and-password accounts must verify their email; until then panel access is limited.
3.4 Each Clinic may give access to its team; it is responsible for their acts and for revoking access.
3.5 We may review and reject page addresses (slugs) that are misleading, offensive or impersonate others.

## 4. Our role

Kalendar is a technical tool. **We do not provide healthcare, psychological, nutritional or other professional services, we are not a party to the relationship between the Clinic and its Patient, and we do not take part in their appointments, prices, cancellations or results.** The Clinic alone is responsible for the service it provides.

## 5. Clinic responsibilities

The Clinic, as **controller** of its patients' and clients' data (art. 24 GDPR), undertakes to:
5.1 Have a valid **legal basis** to process that data (art. 6 GDPR) and, where an appointment may reveal health data (physiotherapy, psychology, nutrition, etc.), a condition under **art. 9.2 GDPR** (usually 9.2.h with professional secrecy, art. 9.3, or explicit consent 9.2.a). Kalendar cannot choose these for you. [DECIDE D2]
5.2 **Inform** its patients under arts. 13–14 GDPR and art. 11 LOPDGDD: its identity as controller and its own privacy policy. It must display this on its booking page.
5.3 Handle its patients' rights (arts. 15–22 GDPR), with our help under the Data Processing Agreement.
5.4 Meet its professional and healthcare duties: professional secrecy, Law 41/2002 (patient autonomy and clinical documentation), codes of ethics, professional registration and insurance. **Kalendar does not replace a clinical-record system**: the Clinic must keep its clinical records outside Kalendar.
5.5 Configure and communicate its **cancellation policy** (the window in hours set in the panel; 24 h by default). Inside the window, the Patient cannot cancel alone and instead requests cancellation, which the Clinic must review. The financial consequences of cancelling or not attending are between Clinic and Patient.
5.6 Keep services, hours, holidays and public information up to date, and comply with the consumer, health-advertising and e-commerce rules that apply to its activity.
5.7 Obtain the permissions needed to use WhatsApp with its patients (section 8).

## 6. Acceptable use and prohibited content

You agree not to:
6.1 **Enter clinical data** (diagnoses, medical records, reports, results, medication, detailed descriptions of symptoms or psychological state) in the booking comment, private client notes, service names or descriptions, or support tickets. Private notes are only for organisational information (e.g. scheduling preferences, accessibility notices) [DECIDE D1]. If you breach this, you bear the responsibility the law gives you as controller and may be required to delete the content.
6.2 Use the service for unlawful purposes, to impersonate another person or clinic, or to send spam or non-consented commercial messages.
6.3 Try to access other clinics' data, breach security, reverse engineer, overload the service, scrape data in bulk or bypass usage limits (for example the per-IP booking limit).
6.4 Upload content that infringes third-party rights or is unlawful or offensive (for example logos or text).
6.5 Resell or give access to third parties outside your business.

We may remove content or suspend accounts that breach this section (see section 12).

## 7. Data protection

7.1 For Clinic account data, KaminoLabs is the controller: see the Privacy Policy.
7.2 For patient and client data, the Clinic is controller and KaminoLabs processor: the **Data Processing Agreement (art. 28 GDPR)** applies, forms part of these Terms and prevails over them on data protection.
7.3 The providers we use are listed in the Data Processing Agreement and the Privacy Policy.

## 8. WhatsApp

8.1 To use WhatsApp bookings, the Clinic must hold its **own Twilio account** and comply with the terms of Twilio and WhatsApp Business/Meta (including messaging, template and commercial-use policies). It gives Kalendar its credentials so we can act on its behalf; we store the Auth Token encrypted.
8.2 The Clinic is responsible for Twilio costs, its number and for ensuring its patients start or consent to the conversation where the rules require.
8.3 Do not use the *sandbox* number with real patient data.
8.4 We may disable the feature if Twilio or Meta change their terms or for security reasons.

## 9. Subscription, free period and price

9.1 Kalendar is offered by **subscription**, charged through **Stripe**. The price and plan terms are shown before you subscribe (art. 27 LSSI-CE). [FILL price, VAT, billing period]
9.2 **Free period.** Clinics in the first cohort get **6 months at no charge** from [FILL trigger: sign-up/verification]. No subscription fee is charged during that period. [DECIDE D14] Before it ends we will email you at least [30] days ahead; charging only starts if you add a payment method and accept the price. If you do not, the service will move to [suspension/limited mode: DECIDE] and your data will be handled as in section 12.
9.3 Prices may change with at least [30] days' notice; if you do not accept, you may cancel before it applies.
9.4 Except where required by law, fees already charged are not refunded for partial periods; [DECIDE refund policy]. Consumer withdrawal rights do not apply to contracts made by businesses or professionals within their activity.
9.5 Non-payment, after notice, may suspend the service.

## 10. Patients and clients (consumers)

10.1 Using the booking page and the portal account is **free** for the Patient. The service relationship with the professional is with the Clinic, not Kalendar.
10.2 You may book as a guest or create an account. Accounts are for people aged [18] or over [DECIDE D10]. If you book for a minor, you must be their parent or legal guardian.
10.3 Provide truthful data. **Do not write clinical data** in the booking comment (see section 6.1).
10.4 You can cancel your appointment from the email link or your portal **within the window the Clinic has set**. After that window you can request cancellation and the Clinic will decide. This does not limit the rights the law gives you against the Clinic.
10.5 Your consumer rights (section 15) are not affected by these Terms.
10.6 You will receive appointment notices (confirmation, reminders, cancellations) **in Spanish**.
10.7 We process your data under the Privacy Policy and, for your appointments, according to the relevant clinic.

## 11. Intellectual property

Kalendar, its software, brand, design and content belong to KaminoLabs or its licensors. We grant you a limited, non-exclusive, non-transferable, revocable licence to use the service while the relationship lasts. **Data and content the Clinic enters remain its own**; it grants us the rights needed to provide the service. Using the Clinic's name and logo in our communications requires its permission.

## 12. Term, suspension and termination

12.1 The contract lasts while the account is active. The Clinic may **cancel at any time** from the panel or by email; cancellation takes effect at the end of the period already paid [DECIDE].
12.2 We may **suspend or terminate** the account for serious breach, security risk, non-payment or legal order, with prior notice and a statement of reasons (**at least [15] days**, except for serious risk or illegality; see Regulation (EU) 2019/1150). [LAWYER: confirm applicability]
12.3 **Data at the end.** After cancellation, the Clinic has **30 days** to **export** its data (read-only mode). After that we securely delete the Clinic's data and that of its patients and clients (backups within [35] days), except what we must keep by law (billing: 6 years). [DECIDE D7; VERIFY export]
12.4 **Deleting the account = cascade deletion.** If the Clinic deletes its account, **its patients' bookings, client records, notes and bonos in Kalendar are also deleted**, and disappear from those patients' portal history. It is irreversible. Before deleting, export what you need and keep in your own system what the law requires (e.g. clinical records). [DECIDE D8]
12.5 Sections 5, 11, 12.3–12.4, 14 and 17 survive termination.

## 13. Availability, maintenance and support

We strive to keep the service continuously available but **do not guarantee uninterrupted availability**. There may be interruptions for maintenance, third-party failures (hosting, database, email, WhatsApp, Stripe) or force majeure. We will give reasonable notice when maintenance can be scheduled. Email or WhatsApp reminders depend on third parties and may be delayed or not delivered; the Clinic must not treat them as guaranteed. Support: [FILL channel and hours]. No service-level agreement (SLA) applies unless agreed in writing. [DECIDE]

## 14. Liability

14.1 We are liable for damage we cause through our breach, as the law provides.
14.2 **Between professionals (Clinic)**, and to the extent the law permits, we are not liable for: lost profit, loss of clients or reputation, indirect damage, or damage arising from third-party failures, content or data entered by the Clinic, the Clinic's professional decisions, or an appointment not reminded or not attended.
14.3 **Cap:** our total liability to the Clinic in any 12-month period will not exceed the **greater** of (a) the fees paid in those 12 months or (b) [FILL € — minimum amount, e.g. €1,000]. The free period does not reduce limit (b). [DECIDE D12; LAWYER]
14.4 **Nothing in these Terms limits or excludes** liability for **wilful misconduct or gross negligence** (art. 1102 Civil Code), for death or personal injury, or any liability the law does not allow to be limited; nor does it limit liability under the GDPR towards data subjects (art. 82 GDPR) or what is agreed in the Data Processing Agreement.
14.5 The Clinic will hold us harmless against third-party claims arising from its breach of these Terms or the law (for example from its patients for misuse of clinical data or lack of legal basis) to the extent of its fault.

## 15. Rights the law does not allow to be limited (consumers)

For Patients acting as **consumers** (Royal Legislative Decree 1/2007, Consolidated Consumer Protection Act, TRLGDCU), these Terms **cannot and do not intend to**:
- exclude or limit consumers' basic rights or have them waived (art. 10 TRLGDCU: prior waiver of rights is void);
- impose unfair terms (arts. 82–91 TRLGDCU), in particular limiting liability for death or personal injury (art. 86), submitting to courts other than the consumer's domicile (art. 90.2) or waiving rights;
- exclude liability for damage caused by a defective product or service (arts. 128 ff. and 147 TRLGDCU);
- limit the legal guarantee of conformity (arts. 114 ff.) or the 14-day withdrawal right in distance contracts (arts. 102 ff.), where applicable;
- limit data-subject rights under the GDPR and LOPDGDD or the right to complain to the AEPD.
The rules on general contract conditions (Law 7/1998, arts. 5, 7 and 8) also apply: unclear terms or those contrary to mandatory rules are void or interpreted in favour of the adhering party. Clinics, being professionals, do not enjoy consumer protection but do enjoy general mandatory rules (e.g. arts. 1102 and 1255 Civil Code; Law 7/1998 art. 8.1). [LAWYER: verify all article citations]

## 16. Changes

We may change these Terms for legal, technical or business reasons. We will email Clinics at least [15] days ahead; if the change harms you, you may cancel without penalty before it applies. Continuing to use the service after that date means acceptance. Changes do not apply to bookings already confirmed.

## 17. Governing law and jurisdiction

These Terms are governed by **Spanish law**. For disputes with **Clinics**, the parties submit to the courts of **[FILL city]**, waiving any other forum. **Consumers** keep the right to go to the courts of their domicile and to out-of-court mechanisms (for example consumer arbitration boards and consumer associations) [LAWYER: add any required alternative-dispute-resolution information]. [DECIDE D13]

## 18. General

If a clause is void, the rest remains valid. Not exercising a right is not a waiver. You may not assign the contract without our consent; we may assign it on a merger or sale of the business with notice. These Terms and the documents they incorporate are the entire agreement. Contact: [FILL email]. Electronic communications count as written communication.
