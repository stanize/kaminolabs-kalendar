"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { reportClientError } from "@/lib/report-client-error";
import { Icon } from "@/components/ui/icon";

export function PatientEmailVerificationGate({ email }: { email: string }) {
  const router = useRouter();

  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [cooldown, setCooldown]       = useState(0);
  const [checking, setChecking]       = useState(false);
  const [notYet, setNotYet]           = useState(false);

  const refreshIfVerified = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await authClient.getSession({ query: { disableCookieCache: true } });
      if (data?.user?.emailVerified) {
        router.refresh();
        window.location.reload();
        return true;
      }
    } catch (e) {
      reportClientError("patientEmailGate:refreshIfVerified", e);
    }
    return false;
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => { void refreshIfVerified(); }, 5000);
    return () => clearInterval(id);
  }, [refreshIfVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function handleResend() {
    if (cooldown > 0 || resendState === "sending") return;
    setResendState("sending");
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: "/patient" });
      setResendState("sent");
      setCooldown(30);
    } catch (e) {
      reportClientError("patientEmailGate:sendVerificationEmail", e);
      setResendState("error");
    }
  }

  async function handleCheckNow() {
    setChecking(true);
    setNotYet(false);
    const verified = await refreshIfVerified();
    setChecking(false);
    if (!verified) setNotYet(true);
  }

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[420px] rounded-2xl bg-surface p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-weak text-brand">
          <Icon name="mail" size={26} />
        </div>
        <h2 className="mb-1.5 text-[19px]">Confirma tu email</h2>
        <p className="mb-1 text-[14px] text-ink-soft">Hemos enviado un enlace de confirmación a</p>
        <p className="mb-5 text-[14px] font-semibold text-ink">{email}</p>

        <button
          type="button"
          onClick={handleCheckNow}
          disabled={checking}
          className="mb-3 w-full rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:brightness-95 disabled:opacity-60"
        >
          {checking ? "Comprobando…" : "Ya he confirmado mi email"}
        </button>

        {notYet && (
          <p className="mb-3 text-[13px] text-error">Todavía no hemos recibido tu confirmación.</p>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resendState === "sending"}
          className="mb-4 w-full rounded-full border border-line px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-60"
        >
          {resendState === "sending"
            ? "Enviando…"
            : cooldown > 0
              ? `Reenviar enlace (${cooldown}s)`
              : "Reenviar enlace"}
        </button>
        {resendState === "sent" && <p className="mb-2 text-[13px] text-brand-ink">Enlace reenviado.</p>}
        {resendState === "error" && <p className="mb-2 text-[13px] text-error">No se pudo reenviar. Inténtalo de nuevo.</p>}

        <button type="button" onClick={handleSignOut} className="text-[13px] font-medium text-ink-soft hover:text-ink">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
