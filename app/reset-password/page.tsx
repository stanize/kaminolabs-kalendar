import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getPublicServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getPublicServerDictionary();
  return { title: `${dict.resetPassword.title} — Kalendar` };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  // Better Auth's own /api/auth/reset-password/:token GET route redirects
  // the browser here with either `?token=<verificationToken>` (valid) or
  // `?error=INVALID_TOKEN` (expired/already used) — see the
  // `sendResetPassword` comment in lib/auth.ts for the full round-trip.
  // `from`/`redirectTo` are our own params, carried through from
  // /forgot-password (which embedded them in the `redirectTo` sent to
  // Better Auth) — Better Auth preserves unknown query params on that URL
  // untouched, only adding `token`/`error` on top.
  searchParams: Promise<{ token?: string; error?: string; from?: string; redirectTo?: string }>;
}) {
  const { dict } = await getPublicServerDictionary();
  const params = await searchParams;
  const token = params.token ?? "";
  const invalid = !token || !!params.error;

  const isPatient = params.from === "patient";
  const safeRedirectTo =
    params.redirectTo && params.redirectTo.startsWith("/") && !params.redirectTo.startsWith("//")
      ? params.redirectTo
      : undefined;
  const patientQS = `${safeRedirectTo ? `?redirectTo=${encodeURIComponent(safeRedirectTo)}` : ""}`;
  const signinHref = isPatient ? `/patient/login${patientQS}` : "/signin";
  const forgotPasswordHref = isPatient
    ? `/forgot-password?from=patient${safeRedirectTo ? `&redirectTo=${encodeURIComponent(safeRedirectTo)}` : ""}`
    : "/forgot-password";

  return (
    <div className="grid min-h-screen items-start justify-items-center bg-surface-2 px-5 pb-12 pt-16 sm:pt-20">
      <div className="w-full max-w-[360px] rounded-2xl border border-line bg-surface px-7 py-6">
        <div className="mb-5 flex flex-col items-center gap-1 text-center">
          <Link href="/" aria-label="Kalendar — volver al inicio" className="mb-1.5">
            <Logo size={18} showText={false} />
          </Link>
          {invalid && (
            <>
              <h1 className="text-[17px] font-medium">{dict.resetPassword.invalidTokenTitle}</h1>
              <p className="text-[12.5px] text-ink-soft">{dict.resetPassword.invalidTokenBody}</p>
            </>
          )}
        </div>

        {invalid ? (
          <Link
            href={forgotPasswordHref}
            className="block w-full rounded-lg bg-brand px-4 py-2 text-center text-[13.5px] font-semibold text-white transition-all hover:bg-brand/90"
          >
            {dict.resetPassword.requestNewLink}
          </Link>
        ) : (
          <ResetPasswordForm
            token={token}
            dict={dict.resetPassword}
            authDict={dict.auth}
            successHref={signinHref}
            backHref={signinHref}
          />
        )}
      </div>
    </div>
  );
}
