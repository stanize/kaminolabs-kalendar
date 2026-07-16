"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient, navigateWithFallback } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import type { PublicDictionary } from "@/lib/i18n/dictionaries/public";

type AuthDict = PublicDictionary["auth"];
type ResetPasswordDict = PublicDictionary["resetPassword"];

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(timeoutMsg)), ms)),
  ]);
}

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none disabled:opacity-50";

export function ResetPasswordForm({
  token,
  dict,
  authDict,
}: {
  token: string;
  dict: ResetPasswordDict;
  authDict: AuthDict;
}) {
  const router = useRouter();
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [success, setSuccess]                 = useState(false);

  async function handleSubmit() {
    setError(null);
    if (password.length < 8)          { setError(authDict.errPasswordLength); return; }
    if (password !== confirmPassword) { setError(authDict.errPasswordMismatch); return; }

    setLoading(true);
    try {
      const result = await withTimeout(
        authClient.resetPassword({ newPassword: password, token }),
        12000,
        authDict.errTimeout
      );
      if (result.error) {
        // Token was valid when the page loaded (we checked ?error server-side
        // in the parent page) but may have been consumed/expired in the time
        // it took to fill the form — same invalid-token UI either way.
        setError(dict.invalidTokenBody);
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch (e) {
      console.error("[reset-password-form] reset failed", e);
      setError(e instanceof Error ? e.message : authDict.errUnexpected);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-[14px] font-medium text-ink">{dict.successTitle}</p>
        <p className="text-[12.5px] leading-[1.5] text-ink-soft">{dict.successBody}</p>
        <button
          type="button"
          onClick={() => navigateWithFallback(router, "/signin")}
          className="mt-1 w-full rounded-lg bg-brand px-4 py-2 text-[13.5px] font-semibold text-white transition-all hover:bg-brand/90"
        >
          {dict.goToSignin}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <input
          type="password"
          placeholder={dict.newPasswordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          className={inputClass}
        />
        <input
          type="password"
          placeholder={authDict.confirmPasswordPlaceholder}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="mt-0.5 w-full rounded-lg bg-brand px-4 py-2 text-[13.5px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? dict.resetting : dict.resetButton}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-error-weak px-3 py-2 text-[12px] font-medium text-error">{error}</p>
      )}

      <Link href="/signin" className="text-center text-[11.5px] font-medium text-brand hover:underline">
        {authDict.back}
      </Link>
    </div>
  );
}
