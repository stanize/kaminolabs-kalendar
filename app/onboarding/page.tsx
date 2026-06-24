import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Crea tu cuenta — Kalendar",
};

export default async function OnboardingPage() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && session?.session?.id) {
      redirect("/panel");
    }
  } catch {
    // No session — show onboarding
  }

  return <OnboardingFlow />;
}
