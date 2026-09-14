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
- UPDATED (2026-09-14, docs/reviews/2026-09-14-review.md — "Recommended next 3" #1 groups this with privacy-policy-page as one combined go-live blocker, not a separate lower-priority item): the earlier "confirm with Arun whether ToS is needed for MVP" question is effectively answered by a second independent review reaching the same conclusion unprompted — treat as needed alongside the privacy policy, not deferred. Still worth a quick explicit confirm from Arun before starting the legal-review clock, but default to "yes, needed" rather than blocking on that confirm.
- Same publish/link requirements as privacy-policy-page (public route, linked from sign-up + footer/landing page) — likely reasonable to scope as one combined legal-review engagement and one combined page/route rather than two separate efforts, given they'll probably be drafted together, but that's an implementation choice to confirm at build time, not a design requirement here.

## Notes / Deviations
- This gap was surfaced by an independent code review session explicitly checking MVP readiness without reference to these workflow files — worth treating as a genuinely fresh finding rather than something previously tracked and missed.
- CORROBORATED (2026-09-14, docs/reviews/2026-09-14-review.md): a second independent review reached the same conclusion — flagged in both the 2026-07-26 and 2026-09-14 reviews as a blind spot that "still hasn't moved." Called out there as the single item to treat as a hard blocker before a real clinic sends real patients through the booking flow, given the product now handles physiotherapy (health-adjacent) patient data under GDPR.
- Legal review lead time makes this different from the other MVP-blocking items (subscription-billing.md's calendar-aligned-billing/trial-period-mechanism/feature-gating) — those are pure engineering work Arun can time-box directly; this one depends on an external review Arun doesn't fully control the timeline of, so starting it early matters more than usual.
