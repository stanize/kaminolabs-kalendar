import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { sendEmail, verificationEmailHtml } from "@/lib/email";

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL!,
  }),
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
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Confirma tu email — Kalendar",
        html: verificationEmailHtml(user.name, url),
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
