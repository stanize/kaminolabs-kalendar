# Supabase + Better Auth Setup — Kalendar

Step-by-step guide to provision the database for Kalendar.

> **Auth model:** Kalendar uses **Better Auth** (running inside Next.js), **not**
> Supabase Auth. Supabase is used **only** as a Postgres database. There is no
> `auth.users` table, no Supabase Google provider, and no Supabase email
> confirmation in this project — all of that is handled by Better Auth.

---

## 1. Create the Supabase project

1. Log in to the dedicated Supabase account for Kalendar (kept separate from other projects).
2. **New project** → choose a region close to Spain (`eu-central-1`).
3. Save the database password somewhere safe — you need it for the connection string.

---

## 2. Get the connection string (Transaction pooler)

Better Auth connects to Postgres directly via `DATABASE_URL` (a `pg` Pool).

1. **Project Settings → Database → Connection string → "Transaction" pooler.**
2. Use the **Transaction pooler** host on port **6543**, e.g.
   `aws-1-eu-central-1.pooler.supabase.com:6543`.
   The direct connection (port 5432) is blocked on the Vercel free plan — always
   use the pooler.
3. This is your `DATABASE_URL`.

---

## 3. Create the auth tables (Better Auth CLI) — run this FIRST

Better Auth owns the `user`, `session`, `account`, and `verification` tables and
manages their shape from the config in `lib/auth.ts`. They are **not** in
`schema_001.sql`, and `schema_001.sql` has foreign keys that reference
`public."user"(id)`, so the auth tables must exist **before** you run the schema.

With `DATABASE_URL` set in `.env.local`, from the project root run:

```bash
npx @better-auth/cli migrate
```

This creates/updates the four auth tables directly in the database. (Use
`npx @better-auth/cli generate` instead if you prefer to review/apply the SQL
manually.) Re-run this whenever `lib/auth.ts` changes the auth config.

---

## 4. Run the Kalendar schema — run this SECOND

1. In your project → **SQL Editor → New query**.
2. Paste the full contents of [`schema_001.sql`](./schema_001.sql) and click **Run**.
3. It is a single consolidated, **destructive** schema: it drops and recreates
   every `kalendar_*` table on each run. There are no incremental migration files
   — when the schema changes, edit `schema_001.sql` and re-run it.

Verify in **Table Editor** that these five tables exist:

- `kalendar_businesses`
- `kalendar_services`
- `kalendar_business_hours`
- `kalendar_team_members`
- `kalendar_support_tickets`

The schema also installs:

- RLS enabled on every table with **permissive** policies. RLS is **not** the
  authorization boundary: all app DB access uses the Supabase **service-role key**
  (Better Auth issues no Supabase JWT, so any `jwt.sub` policy would always fail),
  which bypasses RLS. The real authorization check lives in the app layer
  (`authedAction` + per-query `userId` scoping). Public read is allowed so the
  public booking pages render without a session.
- `ON DELETE CASCADE` foreign keys from every user-scoped column
  (`kalendar_businesses.owner_id`, `kalendar_support_tickets.user_id`) to
  `public."user"(id)`, so deleting a user removes all of their Kalendar data.
- The `set_updated_at` trigger on `kalendar_support_tickets`.
- The `support-attachments` storage bucket (public, 5 MB, image MIME types).

> **Order matters:** if you run `schema_001.sql` before the Better Auth CLI
> migration, the foreign keys will fail because `public."user"` does not exist yet.

---

## 5. Environment variables

Create `.env.local` at the project root, and set the same values in **Vercel →
Project Settings → Environment Variables** (Production, Preview, Development):

| Key | Description |
|---|---|
| `DATABASE_URL` | Supabase Transaction pooler connection string (port 6543) |
| `BETTER_AUTH_SECRET` | Random 32+ char secret for Better Auth |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | `https://kalendar.kaminolabs.dev` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser client only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — used by the server client (`lib/supabase/server.ts`) for all DB access; **server-only, never exposed to the browser** |
| `RESEND_API_KEY` | Resend API key for verification emails (without it, emails are logged/skipped, not sent) |
| `EMAIL_FROM` | Sender, e.g. `Kalendar <no-reply@kaminolabs.dev>` (domain must be verified in Resend) |

Find the Supabase keys in **Project Settings → API**:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` / public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## 6. Google OAuth (configured in Google Cloud, not Supabase)

Better Auth handles the OAuth flow on our own domain, so the callback points at
the app, not at Supabase.

**In Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application** (name: "Kalendar by Kaminolabs").
3. Under **Authorized redirect URIs**, add:
   ```
   https://kalendar.kaminolabs.dev/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
4. Copy the **Client ID** and **Client Secret** into `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`.

No Google configuration is needed inside Supabase.

---

## 7. Email verification (Resend, via Better Auth)

Email/password sign-ups send a verification email automatically
(`emailVerification.sendOnSignUp` in `lib/auth.ts`), delivered through Resend
(`lib/email.ts`). `requireEmailVerification` is **false** — a session is created
on sign-up so the user reaches `/panel`, where a full-screen gate blocks the panel
until `user.emailVerified` is true. Google sign-ups arrive pre-verified and skip
the gate. Set `RESEND_API_KEY` and `EMAIL_FROM` to deliver real emails; without
them sign-up still works, the email is just logged and skipped.

---

## 8. Quick verification checklist

With `npm run dev` running and `.env.local` configured:

- [ ] `/onboarding` → sign up with email/password → land on `/panel` with the
      verification gate shown; **Authentication is Better Auth**, so check the
      `user` table in Supabase (not an `auth.users` table) for the new row.
- [ ] Click the link in the verification email (or flip `emailVerified` manually
      in the `user` table for local testing) → the gate clears.
- [ ] "Continuar con Google" → redirects to Google, returns to `/panel`
      pre-verified (no gate).
- [ ] Create a business later via the in-panel setup flow → a row appears in
      `kalendar_businesses` with related rows in the other `kalendar_*` tables.
- [ ] Visit `/[your-slug]` → the public booking page stub renders the business name.

---

## Tables at a glance

| Table | Owner | Purpose |
|---|---|---|
| `user`, `session`, `account`, `verification` | Better Auth | Identity, sessions, OAuth accounts, email verification tokens |
| `kalendar_businesses` | Kalendar | The business/practice — holds the public slug |
| `kalendar_services` | Kalendar | Bookable services (name, duration, price) |
| `kalendar_business_hours` | Kalendar | Weekly availability, one row per day |
| `kalendar_team_members` | Kalendar | Staff who deliver services |
| `kalendar_support_tickets` | Kalendar | Support requests from the panel |

There is no `kalendar_profiles` table: all per-user identity (id, name, email,
`emailVerified`) comes from Better Auth's `user` table via `session.user`. If
Kalendar-specific per-user fields are ever needed, add a profiles table in
`schema_001.sql` (with the cascade FK convention) at that point.

---

## Deleting test users

```sql
delete from "user" where email = 'user@example.com';
```

Cascades to `account`, `session`, `verification` (Better Auth) **and**
`kalendar_businesses` → `kalendar_services` / `kalendar_business_hours` /
`kalendar_team_members`, plus `kalendar_support_tickets`. Then clear browser
cookies for `kaminolabs.dev`.

### Full reset (wipe all users)

```sql
truncate
  public.kalendar_support_tickets,
  public.kalendar_team_members,
  public.kalendar_business_hours,
  public.kalendar_services,
  public.kalendar_businesses,
  public."account",
  public."session",
  public."verification",
  public."user"
restart identity cascade;

delete from storage.objects where bucket_id = 'support-attachments';
```

---

## What is not in this schema (intentionally)

Out of current scope; added in later sprints:

- `kalendar_bookings` — client reservations
- `kalendar_availability_overrides` — holidays, one-off closures
- `kalendar_notifications` — email / WhatsApp reminders
- `kalendar_payments` — Stripe payment records
