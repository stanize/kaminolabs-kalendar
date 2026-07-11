import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { sendEmail, verificationEmailHtml } from "@/lib/email";
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
