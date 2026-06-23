import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Crea tu cuenta — Kalendar",
};

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user?.id) {
    // Verify user still exists in DB via Supabase (uses pooler, works on Vercel free plan).
    // Guards against stale cookies after test user deletion.
    const supabase = await createClient();
    const { data } = await supabase
      .from("user")
      .select("id")
      .eq("id", session.user.id)
      .maybeSingle();

    if (data) {
      redirect("/panel");
    }
    // No row found = deleted user, stale cookie — fall through to onboarding
  }

  return <OnboardingFlow />;
}
