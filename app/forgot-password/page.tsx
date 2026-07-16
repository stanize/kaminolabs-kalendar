import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getPublicServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getPublicServerDictionary();
  return { title: `${dict.forgotPassword.title} — Kalendar` };
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  // `from=patient` + `redirectTo` let the patient login flow reuse this page
  // instead of duplicating it — carried through to /reset-password on the
  // other side of the emailed link. Absent for the default clinic-owner
  // flow reached from /signin. `redirectTo` is only ever read back out and
  // re-embedded in our own /reset-password link — never redirected to
  // directly here — so no open-redirect risk from it going unvalidated.
  searchParams: Promise<{ from?: string; redirectTo?: string }>;
}) {
  // No signed-in redirect here (unlike /signin, /signup): someone with an
  // active session may still want to reset a forgotten password on another
  // device/browser, so this page stays reachable regardless of session state.
  const { dict } = await getPublicServerDictionary();
  const params = await searchParams;
  const isPatient = params.from === "patient";
  // Same guard as app/patient/login/page.tsx — only ever re-embedded in our
  // own links below, never passed to redirect(), but validate anyway rather
  // than relying on that.
  const safeRedirectTo =
    params.redirectTo && params.redirectTo.startsWith("/") && !params.redirectTo.startsWith("//")
      ? params.redirectTo
      : undefined;
  const carry = isPatient
    ? `?from=patient${safeRedirectTo ? `&redirectTo=${encodeURIComponent(safeRedirectTo)}` : ""}`
    : "";

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

        <ForgotPasswordForm
          dict={dict.forgotPassword}
          authDict={dict.auth}
          redirectPath={`/reset-password${carry}`}
          backHref={isPatient ? `/patient/login${safeRedirectTo ? `?redirectTo=${encodeURIComponent(safeRedirectTo)}` : ""}` : "/signin"}
        />
      </div>
    </div>
  );
}
