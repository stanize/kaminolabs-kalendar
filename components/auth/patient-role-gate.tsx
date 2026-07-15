"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/ui/logo";
import { provisionPatient } from "@/lib/actions/patient";

const LABELS = {
  title: "Un momento",
  body: "Esta cuenta ya existe con otro tipo de acceso. Continuar añadirá el rol de cliente a tu cuenta. ¿Quieres continuar?",
  yes: "Sí, continuar",
  no: "No, cerrar sesión",
};

/**
 * Shown instead of the patient portal when a signed-in user holds some OTHER
 * role but not 'patient' yet. Mirrors RoleUpgradeGate (components/panel/) for
 * the opposite direction — never silently promote an account to patient just
 * because it landed on /patient (e.g. a clinic owner clicking a stray link).
 */
export function PatientRoleGate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleYes() {
    setBusy(true);
    const res = await provisionPatient();
    if (res.ok) {
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  async function handleNo() {
    setBusy(true);
    await authClient.signOut();
    router.push("/patient/login");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-7 shadow-xl">
        <div className="mb-4 flex items-center gap-2.5">
          <Logo showText={false} size={22} />
          <h2 className="text-[20px]">{LABELS.title}</h2>
        </div>
        <p className="text-[14.5px] leading-relaxed text-ink-soft">{LABELS.body}</p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleYes}
            disabled={busy}
            className="w-full rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60"
          >
            {LABELS.yes}
          </button>
          <button
            type="button"
            onClick={handleNo}
            disabled={busy}
            className="w-full rounded-xl border border-line bg-surface px-5 py-3 text-[14px] font-semibold text-ink transition-all hover:border-brand-line disabled:cursor-not-allowed disabled:opacity-50"
          >
            {LABELS.no}
          </button>
        </div>
      </div>
    </div>
  );
}
