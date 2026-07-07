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
  return { title: `${dict.signin.title} — Kalendar` };
}

export default async function SigninPage() {
  // Already logged in — go straight to panel
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && session?.session?.id) {
      redirect("/panel");
    }
  } catch {
    // No session — show sign-in
  }

  // Language was chosen on the home page; carried forward via cookie. No
  // switcher shown here.
  const { dict } = await getPublicServerDictionary();

  return (
    <div className="grid min-h-screen justify-items-center bg-surface-2 px-5 pb-12 pt-16 sm:pt-20">
      <div className="w-full max-w-[360px] rounded-2xl border border-line bg-surface px-7 py-6">
        <div className="mb-5 flex flex-col items-center gap-1 text-center">
          <Link href="/" aria-label="Kalendar — volver al inicio" className="mb-1.5">
            <Logo size={18} showText={false} />
          </Link>
          <h1 className="text-[17px] font-medium">{dict.signin.title}</h1>
          <p className="text-[12.5px] text-ink-soft">{dict.signin.subtitle}</p>
        </div>

        <LoginForm dict={dict.auth} />

        <p className="mt-4 text-center text-[11.5px] text-ink-soft">
          {dict.signin.noAccount}{" "}
          <Link href="/signup" className="font-medium text-brand hover:underline">
            {dict.signin.createFree}
          </Link>
        </p>
      </div>
    </div>
  );
}
