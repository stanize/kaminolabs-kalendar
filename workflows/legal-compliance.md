# Workflow: Legal & Compliance Pages

Public-facing legal pages required before real clinics can put real patient data into the product. No workflow previously tracked this — surfaced by an independent MVP-readiness review, confirmed here: no privacy/legal/terms route exists anywhere under /app today.

## Step: privacy-policy-page
Status: not_started
Criteria:
- A public route exists (e.g. /privacy or /legal/privacy) with an actual privacy policy — currently there is no privacy/legal/terms route anywhere under /app
- Content is legally reviewed for GDPR compliance (Spain/EU) — this is a legal-review task with its own lead time, not just a page to write; start the review clock independently of when the page itself gets coded
- Covers what data is collected (clinic business data, patient/client contact info, booking data), why, retention, and who it's shared with (Stripe, Resend, Supabase as processors)
- Linked from sign-up (both clinic and patient) and from the footer/landing page
- Given data flows through third parties (Stripe for payments, Resend for email, Supabase for storage), the policy needs to name these processors accurately, not use boilerplate that doesn't match the actual stack

## Step: terms-of-service-page
Status: not_started
Criteria:
- Not yet scoped as a distinct requirement from privacy-policy-page — confirm with Arun whether ToS is needed for MVP or can follow later; not currently blocking in the way GDPR/privacy is (privacy policy is a stricter legal requirement given real patient data)

## Notes / Deviations
- This gap was surfaced by an independent code review session explicitly checking MVP readiness without reference to these workflow files — worth treating as a genuinely fresh finding rather than something previously tracked and missed.
- Legal review lead time makes this different from the other MVP-blocking items (subscription-billing.md's calendar-aligned-billing/trial-period-mechanism/feature-gating) — those are pure engineering work Arun can time-box directly; this one depends on an external review Arun doesn't fully control the timeline of, so starting it early matters more than usual.
