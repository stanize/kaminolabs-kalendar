"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import type { PublicDictionary } from "@/lib/i18n/dictionaries/public";

type AuthDict = PublicDictionary["auth"];
type ForgotPasswordDict = PublicDictionary["forgotPassword"];

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(timeoutMsg)), ms)),
  ]);
}

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none disabled:opacity-50";

export function ForgotPasswordForm({ dict, authDict }: { dict: ForgotPasswordDict; authDict: AuthDict }) {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  // Flips to true on any successful (2xx) response from Better Auth, which —
  // by design — includes the "email doesn't exist" case too (it always
  // returns a generic ok:true to avoid leaking which emails are registered).
  // Do not add a separate "account not found" branch here.
  const [sent, setSent]       = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError(authDict.errEmail);
      return;
    }
    setLoading(true);
    try {
      await withTimeout(
        authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: `${window.location.origin}/reset-password`,
        }),
        12000,
        authDict.errTimeout
      );
      setSent(true);
    } catch (e) {
      console.error("[forgot-password-form] request failed", e);
      setError(e instanceof Error ? e.message : authDict.errUnexpected);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-[14px] font-medium text-ink">{dict.checkEmailTitle}</p>
        <p className="text-[12.5px] leading-[1.5] text-ink-soft">{dict.checkEmailBody}</p>
        <Link href="/signin" className="mt-1 text-[12.5px] font-medium text-brand hover:underline">
          {dict.backToSignin}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <input
          type="email"
          placeholder={authDict.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          {loading ? dict.sending : dict.sendLink}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-error-weak px-3 py-2 text-[12px] font-medium text-error">{error}</p>
      )}

      <Link href="/signin" className="text-center text-[11.5px] font-medium text-brand hover:underline">
        {dict.backToSignin}
      </Link>
    </div>
  );
}
