import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { sendEmail, verificationEmailHtml, resetPasswordEmailHtml } from "@/lib/email";
import { LOCALE_COOKIE, DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";

// Reads the `kalendar_locale` cookie off the raw sign-up request (Better Auth
// hands the callback a cloned Request, not Next's cookies() helper) so the
// verification email matches whichever language the user had selected on the
// home page navbar before signing up.
function localeFromRequest(request: Request | undefined): "es" | "en" {
  const cookieHeader = request?.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export const auth = betterAuth({
  database: (() => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      // Explicit cap: on Vercel serverless, an unbounded pool (default max:10
      // per instance) combined with many concurrent invocations against the
      // Supabase transaction pooler can queue/stall connection acquisition
      // instead of failing fast. Keeping this modest and logging exhaustion
      // makes that failure mode visible instead of presenting as a silent
      // client-side freeze.
      max: 5,
    });
    pool.on("error", (err) => {
      console.error("[auth-pool] idle client error", { error: err.message });
    });
    return pool;
  })(),
  emailAndPassword: {
    enabled: true,
    // Keep this false: we still create a session right after sign-up so the
    // user lands on the panel. The panel then greys itself out and prompts for
    // confirmation until `emailVerified` flips to true. Setting this to true
    // would block sign-in entirely and the user could never reach the gate.
    requireEmailVerification: false,
    // Password reset — see app/forgot-password, app/reset-password. Better
    // Auth builds the callback URL itself as
    // `${baseURL}/reset-password/:token?callbackURL=<redirectTo>`; it then
    // 302s the browser from that URL to `<redirectTo>?token=:token` (or
    // `?error=INVALID_TOKEN` if expired/consumed) — `redirectTo` is the
    // `/reset-password` page we pass from the client in
    // authClient.requestPasswordReset(). We only need to email the `url` it
    // hands us here; we never construct that link ourselves.
    resetPasswordTokenExpiresIn: 60 * 60, // 1h
    // Sign the user out of every other device/browser once their password is
    // reset — the reset itself proves email ownership, and this closes any
    // session an attacker may have had if the reset was prompted by a
    // suspected compromise.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }, request) => {
      const locale = localeFromRequest(request);
      await sendEmail({
        to: user.email,
        subject:
          locale === "en"
            ? "Reset your Kalendar password"
            : "Restablece tu contraseña de Kalendar",
        html: resetPasswordEmailHtml(url, locale),
      });
    },
  },
  emailVerification: {
    // Fire the verification email automatically on email/password sign-up.
    sendOnSignUp: true,
    // Once the user clicks the link, sign them in and send them to the panel.
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24h
    sendVerificationEmail: async ({ user, url }, request) => {
      const locale = localeFromRequest(request);
      // sendVerificationEmail is one global Better Auth hook shared by both
      // clinic sign-up (components/auth/signup-form.tsx) and patient
      // sign-up (booking-wizard.tsx, patient-login-form.tsx) — there's no
      // separate hook per audience. Both flows set a different callbackURL
      // (clinic always goes to /panel; patient flows go to /patient or
      // /bookings/...), and Better Auth embeds it as a query param on `url`,
      // so we read it back out to pick the right copy instead of always
      // showing clinic-oriented "automate your clinic" language to patients.
      //
      // When registering mid-booking (booking-wizard.tsx's handleRegister),
      // the callbackURL additionally carries booking details as its own
      // query params (bookingService/bookingWhen/bookingBusiness) — reading
      // those out here lets this ONE email cover both "confirm your
      // account" and "here's your booking" instead of sending two separate
      // emails (this one + submitBooking's "under review" email, which
      // skips itself for this exact case — see lib/actions/booking.ts).
      let audience: "clinic" | "patient" = "clinic";
      let booking: { serviceName: string; whenLabel: string; businessName: string } | null = null;
      try {
        const callbackRaw = new URL(url).searchParams.get("callbackURL") ?? "";
        if (callbackRaw && !callbackRaw.includes("/panel")) audience = "patient";
        if (callbackRaw) {
          // callbackRaw is itself a URL (possibly relative) with its own
          // query string — parse against a dummy base to read those params
          // regardless of whether it's absolute or relative.
          const callbackParams = new URL(callbackRaw, "https://kalendar.kaminolabs.dev").searchParams;
          const serviceName = callbackParams.get("bookingService");
          const whenLabel = callbackParams.get("bookingWhen");
          const businessName = callbackParams.get("bookingBusiness");
          if (serviceName && whenLabel && businessName) {
            booking = { serviceName, whenLabel, businessName };
          }
        }
      } catch {
        // Malformed url — fall back to the plain welcome copy rather than guessing.
      }
      await sendEmail({
        to: user.email,
        subject: booking
          ? (locale === "en" ? `Confirm your email & booking · ${booking.businessName}` : `Confirma tu email y tu reserva · ${booking.businessName}`)
          : locale === "en"
            ? "Welcome to Kalendar! Confirm your email"
            : "¡Bienvenido a Kalendar! Confirma tu email",
        html: verificationEmailHtml(url, locale, audience, booking),
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  trustedOrigins: [
    "https://kalendar.kaminolabs.dev",
    "http://localhost:3000",
    // Vercel-assigned domains for this project specifically (not a
    // *.vercel.app wildcard — that would trust ANY Vercel project's
    // deployment, not just ours, which is an unnecessary CSRF-surface
    // widening). These are easy to test against by accident instead of the
    // custom domain (Vercel shows them prominently in the dashboard), and
    // without listing them a sign-up/sign-in from one silently 400s
    // ("invalid origin") before ever touching the database — indistinguishable
    // from a generic/unexplained failure on the client (this is exactly
    // what caused a "Ocurrió un error" registration failure with no trace
    // in Postgres logs — root-caused via Vercel runtime logs showing a
    // clean 400 on POST /api/auth/sign-up/email).
    "https://kalendar-rouge.vercel.app",
    "https://kalendar-stanizes-projects.vercel.app",
    "https://kalendar-git-main-stanizes-projects.vercel.app",
    // Per-deployment preview URLs (kalendar-<hash>-stanizes-projects.vercel.app)
    // change on every deploy, so they can't be listed individually — this
    // narrower wildcard only matches this project's own preview URL pattern,
    // not other Vercel projects.
    "https://kalendar-*-stanizes-projects.vercel.app",
  ],
});
