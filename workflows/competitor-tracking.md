# Workflow: Competitor Tracking

Not a build workflow like the others — a running log of competitor research (pricing, features, positioning) to inform Kalendar's own pricing and roadmap decisions. "Steps" here are individual competitors tracked, not build tasks; "Status" reflects how current the research is, not implementation progress.

## Step: booksy
Status: done (research current as of 2026-08-19)
Criteria:
- Source: https://biz.booksy.com/es-es/precios (Spain-specific pricing page)
- Pricing model: single flat plan, 34,99€ + IVA/month, all features included at that one tier — explicitly no higher tiers gating more features (stated directly in their FAQ: "no hay niveles más altos para acceder a más funciones")
- Per-seat pricing: +8€ + IVA/month per additional team member beyond the first
- Free trial: 7 days, no credit card required
- No cancellation commitment — month-to-month, cancel anytime
- Optional add-on: "Boost" marketplace visibility feature — free to activate, 30% one-time commission on a Boost-acquired client's first visit only (not recurring)
- Payment processing (optional, separate from the subscription): 2% + 0,15€ per mobile payment transaction; 0,99% + 0,10€ for Tap to Pay; 1,5% for instant (30-min) payouts
- No booking fees ever passed to the clinic's own clients, regardless of plan
- Positioning: targets barberías, peluquerías, salones de uñas, cejas y pestañas, centros de estética — beauty/wellness, not medical/therapy verticals (physiotherapy, psychology, nutrition, coaching aren't in their named business types) — this is a notable gap relative to Kalendar's stated vertical focus
- Feature set at the single price point: unlimited bookings, appointment confirmations/reminders, email marketing, SMS marketing (100 free/month included), custom intake forms & waivers, Google booking integration, reports/analytics, waitlists, no-show protection tools, memberships, punch-card-style bonos, digital loyalty cards

## Notes / Deviations
- Booksy's flat-single-tier, all-features-included pricing model is directly relevant context for subscription-billing.md's own pricing design (kalendar_discount_schedule_templates/phases) — worth a deliberate comparison when Arun next revisits Kalendar's own pricing structure, not necessarily to copy it, but to know what a prospect has likely already seen and priced-compared against.
- Booksy's vertical focus (beauty/wellness, not medical/therapy) is a genuine whitespace signal for Kalendar's own positioning (physiotherapy-first) — worth keeping in mind for marketing/positioning work, separate from any product-workflow decision.
- Future competitors to add as researched: any Spain-specific booking SaaS aimed at physiotherapy/psychology/nutrition specifically (Booksy's gap above suggests there may be a more direct competitor in that narrower space worth finding) — not yet researched, add as its own step when done.
