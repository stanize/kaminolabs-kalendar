import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";
import { SignupForm } from "@/components/auth/signup-form";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: `${dict.onboarding.title} — Kalendar` };
}

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

  const { locale, dict } = await getServerDictionary();

  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-end">
          <LanguageSwitcher current={locale} revalidate="/onboarding" />
        </div>

        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={22} />
          <div>
            <h1 className="text-[24px]">{dict.onboarding.title}</h1>
            <p className="mt-1 text-[15px] text-ink-soft">{dict.onboarding.subtitle}</p>
          </div>
        </div>

        <SignupForm dict={dict.auth} />
      </div>
    </div>
  );
}
