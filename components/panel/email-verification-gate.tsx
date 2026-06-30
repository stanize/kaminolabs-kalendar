"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/ui/icon";
import type { PanelShellDictionary } from "@/lib/i18n/dictionaries/panel-shell";

type VerificationDict = PanelShellDictionary["verification"];

/**
 * Full-screen blocking overlay shown in the panel when the signed-in user's
 * email is not yet verified (email/password sign-ups). Google sign-ups arrive
 * pre-verified and never see this. The panel renders behind it but cannot be
 * interacted with until the email is confirmed.
 */
export function EmailVerificationGate({ email, dict }: { email: string; dict: VerificationDict }) {
  const router = useRouter();

  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [cooldown, setCooldown]       = useState(0);
  const [checking, setChecking]       = useState(false);
  const [notYet, setNotYet]           = useState(false);

  // Returns true (and reloads) if the email is now verified.
  const refreshIfVerified = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await authClient.getSession({
        query: { disableCookieCache: true },
      });
      if (data?.user?.emailVerified) {
        router.refresh();
        window.location.reload();
        return true;
      }
    } catch {
      // ignore — keep showing the gate
    }
    return false;
  }, [router]);

  // Poll in the background so the gate clears on its own once confirmed
  // (e.g. the user clicks the link on another device).
  useEffect(() => {
    const id = setInterval(() => { void refreshIfVerified(); }, 5000);
    return () => clearInterval(id);
  }, [refreshIfVerified]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function handleResend() {
    if (cooldown > 0 || resendState === "sending") return;
    setResendState("sending");
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: "/panel" });
      setResendState("sent");
      setCooldown(30);
    } catch {
      setResendState("error");
    }
  }

  async function handleConfirmed() {
    setChecking(true);
    setNotYet(false);
    const ok = await refreshIfVerified();
    if (!ok) {
      setNotYet(true);
      setChecking(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  const resendLabel =
    cooldown > 0 ? dict.resendCountdownTemplate.replace("{seconds}", String(cooldown)) : dict.resend;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-7 shadow-xl">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-weak text-brand">
          <Icon name="mail" size={22} />
        </div>

        <h2 className="mb-1.5 text-[20px]">{dict.title}</h2>
        <p className="text-[14.5px] leading-relaxed text-ink-soft">
          {dict.bodyPrefix}{" "}
          <span className="font-semibold text-ink">{email}</span>. {dict.bodySuffix}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleConfirmed}
            disabled={checking}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60"
          >
            {checking ? dict.checking : dict.confirmedButton}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resendState === "sending"}
            className="w-full rounded-xl border border-line bg-surface px-5 py-3 text-[14px] font-semibold text-ink transition-all hover:border-brand-line disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resendState === "sending" ? dict.resending : resendLabel}
          </button>
        </div>

        {notYet && (
          <p className="mt-4 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-soft">
            {dict.notYet}
          </p>
        )}
        {resendState === "sent" && (
          <p className="mt-4 rounded-xl bg-brand-weak px-3.5 py-2.5 text-[13px] font-medium text-brand">
            {dict.resent}
          </p>
        )}
        {resendState === "error" && (
          <p className="mt-4 rounded-xl bg-error-weak px-3.5 py-2.5 text-[13px] font-medium text-error">
            {dict.resendError}
          </p>
        )}

        <div className="mt-6 border-t border-line pt-4 text-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-[13px] font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            {dict.signOut}
          </button>
        </div>
      </div>
    </div>
  );
}
