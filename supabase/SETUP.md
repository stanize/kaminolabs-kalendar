# Supabase Setup — Kalendar

Step-by-step guide to configure the dedicated Supabase project for Kalendar.

---

## 1. Create the project

1. Log in to your **dedicated Supabase account** for Kalendar (keep it separate from other projects).
2. **New project** → choose a region close to Spain (`eu-west-1` or `eu-central-1`) for lower latency.
3. Save the database password somewhere safe. You won't need it in code, but it's required if you ever connect external DB tools (e.g. pgAdmin, Supabase CLI).

---

## 2. Run the schema

1. In your project → **SQL Editor** → **New query**.
2. Paste the full contents of [`schema.sql`](./schema.sql) and click **Run**.
3. Verify in **Table Editor** that these five tables exist:
   - `kalendar_profiles`
   - `kalendar_businesses`
   - `kalendar_services`
   - `kalendar_business_hours`
   - `kalendar_team_members`

The schema also installs:
- Row-level security (RLS) on every table — each business is only writable by its owner; public pages can read without an auth session.
- A trigger (`on_auth_user_created`) that automatically creates a `kalendar_profiles` row whenever someone signs up, whether via email/password or Google OAuth.

---

## 3. Environment variables

In **Project Settings → API**, copy:

| Setting | Maps to |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| anon / public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

Create `.env.local` at the project root (there is a `.env.local.example` to copy from):

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

In **Vercel**, add the same two variables under **Project Settings → Environment Variables** for Production, Preview, and Development.

---

## 4. Disable email confirmation (important for the onboarding flow)

Kalendar defers account creation to the **very end of the wizard** — the user fills in all their business details first, then the account is created in one go when they click "Crear mi página". If email confirmation is enabled, `signUp()` returns an unconfirmed session and the onboarding save will fail with an auth error.

To disable it:

1. **Authentication → Providers → Email**
2. Toggle off **"Confirm email"**

> When you're ready to add an email verification step later (recommended before launch), re-enable this and add an intermediate "Check your inbox" screen between the wizard's last step and the success screen — nothing else in the codebase needs to change.

---

## 5. Enable Google OAuth

**In Google Cloud Console:**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Under **Authorized redirect URIs**, add the Supabase callback URL (find it in the next step):
   ```
   https://xxxxxxxx.supabase.co/auth/v1/callback
   ```
4. Copy the generated **Client ID** and **Client Secret**.

**In Supabase:**

1. **Authentication → Providers → Google** → toggle it on.
2. Paste the Client ID and Client Secret from Google.
3. Copy the **Callback URL** shown here — this is what you add to Google Cloud Console in step 3 above.

---

## 6. Configure redirect URLs

In Supabase → **Authentication → URL Configuration**:

- **Site URL**: your production domain, e.g. `https://kalendar.app`
- **Redirect URLs** — add all environments you'll use, one per line:

```
http://localhost:3000/auth/callback
https://kalendar.app/auth/callback
https://*.vercel.app/auth/callback
```

The `*.vercel.app` wildcard covers Vercel preview deployments automatically. If your Supabase plan doesn't support wildcards, add each preview URL explicitly.

---

## 7. Quick verification checklist

With `npm run dev` running and `.env.local` configured:

- [ ] Go to `/onboarding`, fill in the email/password flow through all 5 steps, click "Crear mi página" → you should land on the success screen.
- [ ] Check **Table Editor** in Supabase — you should see a new row in `kalendar_businesses` and its related rows in `kalendar_services`, `kalendar_business_hours`, and `kalendar_team_members`.
- [ ] Check **Authentication → Users** — a new user should appear.
- [ ] Test **"Continuar con Google"** — it should redirect to Google, return to `/onboarding`, skip to step 2 with name and email pre-filled.
- [ ] Visit `/[your-slug]` — the public booking page stub should render with the business name.

---

## Tables at a glance

| Table | Purpose |
|---|---|
| `kalendar_profiles` | User profile, linked 1:1 to `auth.users` |
| `kalendar_businesses` | The business/practice — holds the public slug |
| `kalendar_services` | Bookable services (name, duration, price) |
| `kalendar_business_hours` | Weekly availability, one row per day |
| `kalendar_team_members` | Staff who deliver services |

---

## What is not in this schema (intentionally)

These are out of the current onboarding scope and will be added in later sprints:

- `kalendar_bookings` — client reservations
- `kalendar_availability_overrides` — holidays, one-off closures
- `kalendar_notifications` — email / WhatsApp reminders
- `kalendar_payments` — Stripe payment records
