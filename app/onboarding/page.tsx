import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Crea tu cuenta — Kalendar",
};

export default async function OnboardingPage() {
  // Already signed in — skip straight to the panel.
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && session?.session?.id) {
      redirect("/panel");
    }
  } catch {
    // No session — show the sign-up screen.
  }

  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={22} />
          <div>
            <h1 className="text-[24px]">Crea tu cuenta</h1>
            <p className="mt-1 text-[15px] text-ink-soft">
              Tu página de reservas, lista en 2 minutos.
            </p>
          </div>
        </div>

        <SignupForm />
      </div>
    </div>
  );
}
