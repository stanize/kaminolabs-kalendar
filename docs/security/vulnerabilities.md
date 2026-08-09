# Kalendar — Vulnerabilities & Abuse-Resistance Tracker

Living doc for known vulnerabilities, abuse scenarios, and their mitigation
status. Started 2026-08-09, ahead of the September MVP launch, in response to
a general concern about competitors or bad actors trying to disrupt the
product once live (e.g. slot-spam, signup floods, credential attacks).

Status values: `OPEN` (nothing done), `PLANNED` (scoped, not built),
`MITIGATED` (fix shipped), `ACCEPTED` (known risk, deliberately deferred).

---

## Critical

### V-001 — Cron endpoints fail OPEN if `CRON_SECRET` is unset
- **Where:** `app/api/cron/send-reminders/route.ts`, `app/api/cron/sweep-expired-bookings/route.ts`
- **Issue:** Auth check is `if (cronSecret && authHeader !== ...)`. If
  `CRON_SECRET` is ever empty/undefined (env misconfig, deploy race), the
  condition short-circuits false and the route runs **unauthenticated**.
  Should fail closed: `if (!cronSecret || authHeader !== ...)`.
- **Impact:** Anyone could trigger reminder sends or the expiry sweep on
  demand if the secret is ever missing. Low likelihood, wrong failure
  direction.
- **Status:** OPEN
- **Fix effort:** Trivial (one-line change x2 files)

### V-002 — `submitBooking` has no rate limiting or bot defense
- **Where:** `lib/actions/booking.ts` — public server action, no auth required
- **Issue:** No IP throttle, no CAPTCHA, no per-email/per-slug cap on booking
  submissions.
- **Impact:**
  - **Inventory denial** — scripted mass `pending_confirmation` bookings can
    fill all open slots for a targeted clinic; real patients see no
    availability until the hourly expiry sweep clears junk bookings (up to
    ~24h exposure window).
  - **Email bombing** — every submission fires guest + owner emails via
    Resend; burns quota and floods the clinic owner's inbox (looks like
    harassment even if the DB itself is fine).
  - **DB load** — cheap to script at volume today.
- **Status:** OPEN
- **Planned mitigation:** IP-based rate limiting (Upstash Redis-backed
  counter, works across serverless invocations) + optional/on-demand
  Cloudflare Turnstile (see V-004 for the toggle design).

---

## High

### V-003 — `/api/auth/*` (Better Auth) has no rate limiting
- **Where:** `proxy.ts` explicitly passes `/api/auth/**` through
  unconditionally; Better Auth has no built-in rate limiting.
- **Issue:** Exposed to credential stuffing on sign-in, brute-force on
  email/password login, and possible account enumeration via
  forgot-password (need to verify response doesn't differ for known vs
  unknown email).
- **Status:** OPEN
- **Planned mitigation:** Same Upstash-backed IP throttle approach as
  V-002, applied to `/api/auth/sign-up`, `/api/auth/sign-in`, and
  `/api/auth/forgot-password`.

### V-004 — New-account signups: no abuse throttle
- **Where:** `components/auth/signup-form.tsx` → Better Auth sign-up
- **Decision (2026-08-09):** Rather than always-on friction, use an
  **on-demand CAPTCHA toggle**:
  - Default: no CAPTCHA, frictionless signup.
  - A flag (`signupCaptchaEnabled`, separate flag `bookingCaptchaEnabled`
    for V-002) can be manually armed by Arun via the admin portal when he
    notices an abnormal spike in signups over the trailing 1h window.
  - Once armed, CAPTCHA (Cloudflare Turnstile) is required on that
    endpoint for 6 hours, or until manually disabled early.
  - Fast-follow idea (not required for launch): auto-arm if signups in the
    last 1h exceed ~5x rolling baseline for that hour-of-day, still with
    manual override to disable false alarms.
  - Storage: small `kalendar_security_flags` table — `flag_name`,
    `enabled_until`, `enabled_by`.
  - Also needs: a lightweight "signups in last 1h vs rolling baseline"
    widget in the admin portal so Arun has something to look at rather
    than eyeballing raw table counts.
- **Status:** PLANNED (design agreed, not yet built)
- **Also applies a basic IP cooldown regardless of CAPTCHA state:** e.g.
  max 3 signups per IP per 10-minute sliding window, always on (cheap,
  near-zero false-positive risk, stops the most naive scripted abuse
  even when CAPTCHA is off).

---

## Medium

### V-005 — `checkSlugAvailability` / `getAvailableSlots` unthrottled public reads
- **Where:** `lib/actions/business.ts` (`checkSlugAvailability`),
  `lib/actions/booking.ts` (`getAvailableSlots`)
- **Issue:** No rate limiting. Cheap to hammer for DB load; slug-checking
  could also be scraped to enumerate/squat on business names during
  onboarding reconnaissance.
- **Status:** OPEN
- **Planned mitigation:** Same Upstash IP-throttle infra as V-002/V-003,
  lower priority than the write-path endpoints.

### V-006 — PDF portal `/d/{id}?token=` render endpoint
- **Where:** `stanize/kaminolabs-pdfs`, `GET /d/{id}?token=`
- **Issue:** Token-based access, but first-access renders are done live via
  Puppeteer + `@sparticuz/chromium` — expensive. Need to confirm: (a) token
  is unguessable/crypto-random, (b) there's a rate limit or cache-check
  before triggering a fresh render on repeated invalid-token requests.
- **Status:** OPEN — needs code review in the pdfs repo to confirm current
  behavior before scoping a fix.

---

## Verified OK (no action needed)

### V-007 — `confirm_token` generation
- **Where:** `lib/actions/booking.ts`
- **Finding:** `randomBytes(24).toString("base64url")` — 192 bits of
  entropy, cryptographically random. Not brute-forceable.
- **Status:** MITIGATED (verified, was already correct)

### V-008 — Double-booking race conditions
- **Where:** DB-level partial unique index
  `kalendar_bookings_active_slot_idx` on
  `(business_id, coalesce(team_member_id, '00000000-...'), starts_at)`
  WHERE `status in (pending_confirmation, confirmed)`.
- **Finding:** Enforced at the database level — cannot be raced around
  even under concurrent spam/high-volume submission attempts. Cancelled/
  completed bookings are excluded so freed slots correctly rebook.
- **Status:** MITIGATED (verified, was already correct)

---

## Infra / platform-level (not code)

### V-009 — Vercel plan tier and DDoS protection
- **Issue:** Need to confirm current Vercel plan (Hobby vs Pro) — Hobby's
  DDoS/attack protection is materially thinner than Pro's Attack Challenge
  Mode / Firewall rules.
- **Status:** OPEN — confirm current plan with Arun, decide whether to
  upgrade before September launch.

---

## Priority order for September MVP

1. V-001 — cron fail-open fix (trivial, do immediately)
2. V-002 — rate limiting + IP cooldown on `submitBooking` (highest real-world
   impact: protects clinics' actual slot inventory, not just our own infra)
3. V-004 — signup IP cooldown (always-on) + on-demand CAPTCHA flag/toggle
   + admin portal signup-rate widget
4. V-003 — extend same rate-limit infra to `/api/auth/*`
5. V-005 — extend to `checkSlugAvailability` / `getAvailableSlots`
6. V-009 — confirm Vercel plan, upgrade if needed
7. V-006 — review PDF portal render endpoint
