# Client Email Branding Redesign — Build Log

Triggered by Arun sharing two reference screenshots: our own reminder email
(plain "Kalendar" header) vs. a Clínica Dental Adeslas reminder (clinic's own
branding in the header, icon-prefixed detail rows, a single "Gestionar mi
cita" button). Ask: mimic that format, with the *clinic's* name in the header
instead of "Kalendar", applied identically across every client-facing email.

## Scope

**Changed — every CLIENT-facing email** (the ones a clinic's own customers
receive):
- `bookingConfirmEmailHtml` (both the "please confirm" and "already
  confirmed" variants)
- `bookingUnderReviewEmailHtml`
- `bookingCancelledClientHtml`
- `appointmentReminder24hEmailHtml` / `appointmentReminder1hEmailHtml`

**Deliberately NOT changed — emails to the business owner** (Arun's own
customers, i.e. the clinic owners, not their patients):
- `ownerBookingNotificationHtml`
- `bookingCancelledOwnerHtml`

These keep the fixed "Kalendar" header — they're Kalendar's own product
notifications to the person running the clinic, not something a patient
sees, so "clinic branding" doesn't apply. Every email, client- or
owner-facing, still credits Kalendar in the small footer print either way.

## What changed, mechanically (`lib/email.ts`)

- **Header**: `emailShell()` now takes a `headerLabel` and `brandColor`
  instead of always rendering a fixed "📅 Kalendar" mark. Client-facing
  templates pass the booking's own `businessName`; owner-facing templates
  still pass the literal string `"Kalendar"`.
- **Brand color**: reused the **existing** `kalendar_businesses.brand_color`
  column (already there, default `#0d9488` — the same teal used before) as
  the header background and the primary CTA button color. No schema change
  needed — this was already being collected in the Negocio setup flow, just
  never used in emails until now. A `safeBrandColor()` guard falls back to
  the default teal if the stored value isn't a valid `#rrggbb` (defensive
  only; the column already has a not-null default and no free-text input
  path that could produce a bad value).
- **Icon rows**: `emailInfoBox()` rows gained an optional `icon` field,
  rendered as a small emoji glyph before the label — consistent with the
  emoji already used elsewhere in these templates (📅, 🕐, ✓, ✕), rather than
  introducing image or SVG icons that are less reliable across email
  clients. Mapping: 🕐 when, ⭐ service/type, 👤 professional, 📍 address, 🏥
  clinic.
- **CTA button**: `emailButton()` now takes the brand color. Templates that
  previously only had a plain text "Cancela tu cita aquí" link
  (`bookingUnderReviewEmailHtml`, both reminder templates) now get a full
  "Gestionar mi cita" / "Gestionar mi solicitud" button instead, matching
  the Adeslas reference. `bookingConfirmEmailHtml`'s "confirm" CTA already
  had its own button (unchanged, just recolored); its pending-variant
  secondary cancel line was left as a text link since it already has a
  distinct primary action (confirm) and doesn't need a second button
  competing for attention. `bookingCancelledClientHtml` gets no CTA
  (nothing left to manage on an already-cancelled booking) — just icon rows
  in the new header style.
- **"Gestionar mi cita" destination**: for now this points at the same
  tokenized cancel/manage URL as before (`confirm_token`-based). There's no
  dedicated reschedule/manage page yet — noted so a future reschedule build
  knows this button already exists and just needs a richer destination.

## Threading `brandColor` to call sites

`brand_color` was already selected by `lib/business/data.ts`'s
`BUSINESS_COLUMNS` (used by both `getActiveBusinessBySlug` and
`getBusinessForUser`), so most call sites just needed one extra field
passed through — no new query needed:

- `lib/actions/booking.ts` — `bookGuestSlot`'s confirm/under-review sends
  (from `data.business.brand_color`); `notifyCancellation` needed
  `brand_color` added to its own inline `kalendar_businesses` select (it
  wasn't using the shared `getActiveBusinessBySlug` helper).
- `lib/actions/booking-owner.ts` — all three confirmation-email call sites
  (owner-confirms-pending, manual create, manual edit), all already had
  `business.brand_color` available via `getBusinessForUser`.
- `app/api/cron/sweep-expired-bookings/route.ts` — added `brand_color` to
  its inline `kalendar_businesses!inner(...)` select.
- `app/api/cron/send-reminders/route.ts` — same, added `brand_color` to its
  inline select and to the `CandidateBooking` type.

## Validation

`npx tsc --noEmit` and `npx eslint` both clean across every touched file:
`lib/email.ts`, `lib/actions/booking.ts`, `lib/actions/booking-owner.ts`,
`app/api/cron/send-reminders/route.ts`,
`app/api/cron/sweep-expired-bookings/route.ts`.

## Status

Code complete, not yet pushed as of writing this entry. Next: push, then a
live re-test of at least one reminder email to confirm the new header +
icon rows + button render correctly in an actual inbox (not just visually
inspected HTML).
