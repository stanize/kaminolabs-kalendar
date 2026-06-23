import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Crea tu cuenta — Kalendar",
};

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Already logged in — send to panel
  if (session?.user) {
    redirect("/panel");
  }

  return <OnboardingFlow />;
}
