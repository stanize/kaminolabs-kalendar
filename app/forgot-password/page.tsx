import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getPublicServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getPublicServerDictionary();
  return { title: `${dict.forgotPassword.title} — Kalendar` };
}

export default async function ForgotPasswordPage() {
  // No signed-in redirect here (unlike /signin, /signup): someone with an
  // active session may still want to reset a forgotten password on another
  // device/browser, so this page stays reachable regardless of session state.
  const { dict } = await getPublicServerDictionary();

  return (
    <div className="grid min-h-screen items-start justify-items-center bg-surface-2 px-5 pb-12 pt-16 sm:pt-20">
      <div className="w-full max-w-[360px] rounded-2xl border border-line bg-surface px-7 py-6">
        <div className="mb-5 flex flex-col items-center gap-1 text-center">
          <Link href="/" aria-label="Kalendar — volver al inicio" className="mb-1.5">
            <Logo size={18} showText={false} />
          </Link>
          <h1 className="text-[17px] font-medium">{dict.forgotPassword.title}</h1>
          <p className="text-[12.5px] text-ink-soft">{dict.forgotPassword.subtitle}</p>
        </div>

        <ForgotPasswordForm dict={dict.forgotPassword} authDict={dict.auth} />
      </div>
    </div>
  );
}
