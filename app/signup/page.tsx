import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { getPublicServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getPublicServerDictionary();
  return { title: `${dict.signup.title} — Kalendar` };
}

export default async function SignupPage() {
  // Already signed in — skip straight to the panel.
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && session?.session?.id) {
      redirect("/panel");
    }
  } catch {
    // No session — show the sign-up screen.
  }

  // Language was chosen on the home page (navbar switcher); this page just
  // reads the cookie and carries it forward — no switcher shown here.
  const { dict } = await getPublicServerDictionary();

  return (
    <div className="grid min-h-screen md:grid-cols-[42%_58%]">
      {/* Top (mobile) / left (desktop) panel — dark, headline + subtitle.
          On mobile it also carries the "already have an account" line,
          since there's no room for the desktop's top-right placement. */}
      <div className="flex flex-col justify-center bg-ink px-6 py-10 sm:px-10 md:px-14 md:py-16">
        <p className="mb-6 text-[13.5px] text-white/70 md:hidden">
          {dict.auth.haveAccount}{" "}
          <Link href="/signin" className="font-semibold text-white hover:underline">
            {dict.auth.signIn} →
          </Link>
        </p>
        <h1 className="max-w-[360px] text-[26px] leading-[1.2] text-white md:text-[32px] md:leading-[1.15]">
          {dict.signup.title}
        </h1>
        <p className="mt-3 max-w-[340px] text-[15px] leading-relaxed text-white/70 md:mt-4 md:text-[15.5px]">
          {dict.signup.subtitle}
        </p>
      </div>

      {/* Bottom (mobile) / right (desktop) panel — the form. */}
      <div className="relative flex flex-col justify-center px-6 py-10 sm:px-12 md:py-16 md:px-16">
        <p className="absolute right-6 top-6 hidden text-[13.5px] text-ink-soft md:block">
          {dict.auth.haveAccount}{" "}
          <Link href="/signin" className="font-semibold text-ink hover:underline">
            {dict.auth.signIn} →
          </Link>
        </p>

        <div className="mx-auto w-full max-w-[380px]">
          <h2 className="mb-6 text-[20px] font-semibold">{dict.signup.title}</h2>
          <SignupForm dict={dict.auth} />
        </div>
      </div>
    </div>
  );
}
