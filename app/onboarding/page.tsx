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

    // Only redirect if Better Auth confirms a valid active session
    if (session?.user?.id && session?.session?.id) {
      redirect("/panel");
    }
  } catch {
    // Session invalid or expired — show onboarding
  }

  return <OnboardingFlow />;
}
