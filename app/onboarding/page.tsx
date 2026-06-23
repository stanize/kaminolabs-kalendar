import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Pool } from "pg";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Crea tu cuenta — Kalendar",
};

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user?.id) {
    // Verify the user actually exists in the DB — guards against stale cookies
    // after a test user deletion. Single PK lookup, very cheap.
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    try {
      const { rows } = await pool.query(
        'SELECT id FROM "user" WHERE id = $1 LIMIT 1',
        [session.user.id]
      );
      if (rows.length > 0) {
        redirect("/panel");
      }
      // User not found in DB — stale cookie, let them re-register
    } finally {
      await pool.end();
    }
  }

  return <OnboardingFlow />;
}
