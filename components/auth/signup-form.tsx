"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import type { PublicDictionary } from "@/lib/i18n/dictionaries/public";

type AuthDict = PublicDictionary["auth"];

// Small fixed list for now — country isn't persisted anywhere yet, this is
// just the visual field GitHub-style signup screens show. Spain is the
// default since Madrid is the initial market. Expand/wire up to a real
// field later if the business needs it.
const COUNTRIES = [
  { code: "ES", label: "España" },
  { code: "PT", label: "Portugal" },
  { code: "MX", label: "México" },
  { code: "AR", label: "Argentina" },
  { code: "CO", label: "Colombia" },
  { code: "OTHER", label: "Otro" },
];

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(timeoutMsg)), ms)),
  ]);
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-[14px] text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none disabled:opacity-50";

export function SignupForm({ dict }: { dict: AuthDict }) {
  const router = useRouter();

  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [name, setName]                       = useState("");
  const [email, setEmail]                     = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry]                 = useState("ES");
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    setLoadingGoogle(true);
    try {
      // Google emails are pre-verified, so the panel loads with no gate.
      await authClient.signIn.social({ provider: "google", callbackURL: "/panel" });
    } catch {
      setError(dict.errGoogle);
      setLoadingGoogle(false);
    }
  }

  async function handleRegister() {
    setError(null);
    if (!name.trim())                 { setError(dict.errName); return; }
    if (!email.trim())                { setError(dict.errEmail); return; }
    if (password.length < 8)          { setError(dict.errPasswordLength); return; }
    if (password !== confirmPassword) { setError(dict.errPasswordMismatch); return; }

    setLoading(true);
    try {
      const result = await withTimeout(
        authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          // Drives the verification email link target after the user confirms.
          callbackURL: "/panel",
        }),
        12000,
        dict.errTimeout
      );

      if (result.error) {
        const msg = (result.error.message ?? "").toLowerCase();
        setError(
          msg.includes("already") || msg.includes("exist")
            ? dict.errEmailExists
            : dict.errGeneric
        );
        setLoading(false);
        return;
      }

      // Session is created immediately (requireEmailVerification is off). The
      // verification email is sent automatically on sign-up; the panel shows a
      // blocking confirmation gate until the user verifies.
      router.push("/panel");
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.errUnexpected);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loadingGoogle}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-3 text-[14.5px] font-semibold text-ink shadow-sm transition-all hover:border-brand-line hover:shadow-md disabled:cursor-wait disabled:opacity-60"
      >
        <GoogleIcon />
        {loadingGoogle ? dict.connecting : dict.continueGoogle}
      </button>

      <div className="flex items-center gap-3 text-[12px] font-medium text-ink-soft">
        <div className="h-px flex-1 bg-line" />
        o
        <div className="h-px flex-1 bg-line" />
      </div>

      <div className="flex flex-col gap-3">
        <input
          type="text"
          placeholder={dict.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          className={inputClass}
        />
        <input
          type="email"
          placeholder={dict.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className={inputClass}
        />
        <input
          type="password"
          placeholder={dict.passwordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          className={inputClass}
        />
        <input
          type="password"
          placeholder={dict.confirmPasswordPlaceholder}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => e.key === "Enter" && handleRegister()}
          className={inputClass}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink-soft">{dict.countryLabel}</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={loading}
            className={inputClass}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleRegister}
          disabled={loading}
          className="mt-1 w-full rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? dict.creating : dict.createAccount}
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-error-weak px-3.5 py-2.5 text-[13px] font-medium text-error">{error}</p>
      )}

      <p className="text-center text-[12px] leading-[1.5] text-ink-soft">
        {dict.termsPrefix}{" "}
        <a href="#" className="underline hover:text-ink">{dict.terms}</a>{" "}
        {dict.termsAnd}{" "}
        <a href="#" className="underline hover:text-ink">{dict.privacy}</a>{" "}
        {dict.termsSuffix}
      </p>

      <p className="text-center text-[13px] text-ink-soft sm:hidden">
        {dict.haveAccount}{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          {dict.signIn}
        </Link>
      </p>
    </div>
  );
}
