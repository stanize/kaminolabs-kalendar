"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/ui/logo";

const LABELS = {
  title: "Esta cuenta ya existe como cuenta de clínica",
  bodyPrefix: "La cuenta",
  bodySuffix: "ya existe como cuenta de clínica. No es posible añadir el acceso de cliente a esta cuenta por tu cuenta. Si necesitas ambos tipos de acceso, contacta con soporte.",
  action: "Ir a mi panel",
};

/**
 * Shown instead of the patient portal when a signed-in user holds some OTHER
 * role but not 'patient' yet (e.g. a clinic owner clicking a stray /patient
 * link). Per the 2026-09-14 no-self-service-dual-role-accounts decision
 * (workflows/clinic-onboarding.md), this account is NEVER silently or
 * self-service promoted to patient — there's no "add this role too" option
 * any more.
 *
 * SIGNS OUT before redirecting (2026-09-20, Arun feedback — see
 * components/panel/role-upgrade-gate.tsx's matching comment for the full
 * rationale): landing straight in /panel while still holding the same
 * session made it unclear which account was actually active after a
 * couple of these. Signing out first and sending them to /signin makes the
 * switch explicit instead. A second role is granted only by Arun,
 * manually, from a support ticket (admin-portal-tools.md's
 * manual-role-grant-tool).
 */
export function PatientRoleGate({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleGoToPanel() {
    setBusy(true);
    await authClient.signOut();
    router.push("/signin");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-7 shadow-xl">
        <div className="mb-4 flex items-center gap-2.5">
          <Logo showText={false} size={22} />
          <h2 className="text-[20px]">{LABELS.title}</h2>
        </div>
        {/* Names the exact account so the person can immediately tell
            whether they landed here with the wrong email (feedback from
            Arun testing 2026-09-19). */}
        <p className="text-[14.5px] leading-relaxed text-ink-soft">
          {LABELS.bodyPrefix} <span className="font-semibold text-ink">{email}</span> {LABELS.bodySuffix}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleGoToPanel}
            disabled={busy}
            className="w-full rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60"
          >
            {LABELS.action}
          </button>
        </div>
      </div>
    </div>
  );
}
