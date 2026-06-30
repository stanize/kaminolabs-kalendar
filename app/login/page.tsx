import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { LoginForm } from "@/components/auth/login-form";
import { getPublicServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getPublicServerDictionary();
  return { title: `${dict.login.title} — Kalendar` };
}

export default async function LoginPage() {
  // Already logged in — go straight to panel
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && session?.session?.id) {
      redirect("/panel");
    }
  } catch {
    // No session — show login
  }

  // Language was chosen on the home page; carried forward via cookie. No
  // switcher shown here.
  const { dict } = await getPublicServerDictionary();

  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={22} />
          <div>
            <h1 className="text-[24px]">{dict.login.title}</h1>
            <p className="mt-1 text-[15px] text-ink-soft">{dict.login.subtitle}</p>
          </div>
        </div>

        <LoginForm dict={dict.auth} />

        <p className="mt-6 text-center text-[13px] text-ink-soft">
          {dict.login.noAccount}{" "}
          <Link href="/onboarding" className="font-medium text-brand hover:underline">
            {dict.login.createFree}
          </Link>
        </p>
      </div>
    </div>
  );
}
