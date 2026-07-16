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
      await sendEmail({
        to: user.email,
        subject:
          locale === "en"
            ? "Welcome to Kalendar! Confirm your email"
            : "¡Bienvenido a Kalendar! Confirma tu email",
        html: verificationEmailHtml(url, locale),
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
  ],
});
