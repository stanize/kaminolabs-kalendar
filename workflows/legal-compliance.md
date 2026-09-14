# Workflow: Legal & Compliance Pages

Public-facing legal pages required before real clinics can put real patient data into the product. No workflow previously tracked this — surfaced by an independent MVP-readiness review, confirmed here: no privacy/legal/terms route exists anywhere under /app today.

## Design (confirmed with Arun, 2026-09-14)

Access/plumbing and content are being built as two separate phases, deliberately: the page shell + routing + links go in now; Arun uploads the GDPR-legally-reviewed text separately once that review completes, at which point it's a content swap only, no structural changes.

- **Routes**: `/legal/privacy` and `/legal/terms` — grouped under one prefix (room for a future cookies policy etc., rather than cluttering the root).
- **Content storage**: `.md` files (`content/legal/privacy.md`, `content/legal/terms.md`), rendered via `react-markdown` (new dependency — lightweight, no build-config needed, unlike MDX). Chosen over hand-written JSX because the content is genuinely document-shaped (headings, numbered sections, lists) and will occasionally need minor revisions later (a clause tweak, a processor added/removed) — much lower-risk to edit as a `.md` file than as JSX mixed with layout code. Matches the actual handoff: Arun reviews a document, that text goes into the `.md` file as-is.
- **Placeholder content**: both routes go live NOW with clearly-marked draft/"coming soon" text, not held back behind `href="#"` until real content lands — worst case a visitor briefly sees a placeholder page, not a dead link.
- **Wire up links immediately** (not deferred to when real content arrives) — three spots already exist, currently pointing at `href="#"`:
  - `components/auth/signup-form.tsx` (clinic sign-up) — `dict.terms`/`dict.privacy` links, ~line 190-194
  - `components/auth/patient-login-form.tsx` (patient sign-up/login) — `L.terms`/`L.privacy` links, ~line 389-393
  - Landing page footer (`app/page.tsx`) — currently has NO legal links at all (just tagline + copyright), needs them added
  - `components/booking/booking-wizard.tsx` — `af.termsNote` (~line 717), CONFIRMED (2026-09-14): unlike the two spots above, this is currently a single plain-text string with no embedded links at all (`"Al continuar aceptas los términos y la política de privacidad de Kalendar."` — no anchors). Needs the same split-into-linked-terms/privacy treatment as signup-form.tsx/patient-login-form.tsx, not just a link swap — a dict/JSX restructure, not a one-line href fix.

## Step: privacy-policy-page
Status: not_started
Criteria:
- A public route exists (e.g. /privacy or /legal/privacy) with an actual privacy policy — currently there is no privacy/legal/terms route anywhere under /app
- Content is legally reviewed for GDPR compliance (Spain/EU) — this is a legal-review task with its own lead time, not just a page to write; start the review clock independently of when the page itself gets coded
- Covers what data is collected (clinic business data, patient/client contact info, booking data), why, retention, and who it's shared with (Stripe, Resend, Supabase as processors)
- Linked from sign-up (both clinic and patient) and from the footer/landing page
- Given data flows through third parties (Stripe for payments, Resend for email, Supabase for storage), the policy needs to name these processors accurately, not use boilerplate that doesn't match the actual stack
- UPDATED (2026-09-14, design confirmed above): route is `/legal/privacy` specifically (not just "e.g." — settled). Build the route/shell + wire up all link sites NOW with placeholder content; the legally-reviewed text is a separate, later content swap into `content/legal/privacy.md` once Arun uploads it — don't block starting/shipping the shell on the review being done.

## Step: terms-of-service-page
Status: not_started
Criteria:
- UPDATED (2026-09-14, docs/reviews/2026-09-14-review.md — "Recommended next 3" #1 groups this with privacy-policy-page as one combined go-live blocker, not a separate lower-priority item): the earlier "confirm with Arun whether ToS is needed for MVP" question is effectively answered by a second independent review reaching the same conclusion unprompted — treat as needed alongside the privacy policy, not deferred. Still worth a quick explicit confirm from Arun before starting the legal-review clock, but default to "yes, needed" rather than blocking on that confirm.
- Same publish/link requirements as privacy-policy-page (public route, linked from sign-up + footer/landing page) — likely reasonable to scope as one combined legal-review engagement and one combined page/route rather than two separate efforts, given they'll probably be drafted together, but that's an implementation choice to confirm at build time, not a design requirement here.
- UPDATED (2026-09-14, design confirmed above): route is `/legal/terms` specifically. Same shell-now/content-later split as privacy-policy-page — build + wire up now with placeholder content, content swap into `content/legal/terms.md` once reviewed text is uploaded. Shares the same `react-markdown` rendering approach — likely one shared layout/page-shape for both routes given the identical structure, an implementation detail to confirm at build time.

## Notes / Deviations
- This gap was surfaced by an independent code review session explicitly checking MVP readiness without reference to these workflow files — worth treating as a genuinely fresh finding rather than something previously tracked and missed.
- CORROBORATED (2026-09-14, docs/reviews/2026-09-14-review.md): a second independent review reached the same conclusion — flagged in both the 2026-07-26 and 2026-09-14 reviews as a blind spot that "still hasn't moved." Called out there as the single item to treat as a hard blocker before a real clinic sends real patients through the booking flow, given the product now handles physiotherapy (health-adjacent) patient data under GDPR.
- Legal review lead time makes this different from the other MVP-blocking items (subscription-billing.md's calendar-aligned-billing/trial-period-mechanism/feature-gating) — those are pure engineering work Arun can time-box directly; this one depends on an external review Arun doesn't fully control the timeline of, so starting it early matters more than usual.
- Design session (2026-09-14): Arun explicitly wanted the access/plumbing designed and built ahead of the content, specifically so the legal-review lead time doesn't block shipping the shell — see Design section above. `react-markdown` will be a new dependency; verify it's actually added (`package.json`) when this step's status changes, not just assumed from this note.
