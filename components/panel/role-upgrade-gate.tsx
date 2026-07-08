"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { confirmClinicRoleAdd } from "@/lib/actions/role-upgrade";
import type { PanelShellDictionary } from "@/lib/i18n/dictionaries/panel-shell";

type RoleUpgradeDict = PanelShellDictionary["roleUpgrade"];

/**
 * Shown instead of the panel when a signed-in user holds the 'patient' role
 * but not 'clinic' yet. Mirrors the confirm-before-cross-role-add prompt in
 * the booking wizard's ConfirmAuthModal, for the opposite direction — never
 * silently promote a patient account to clinic just because it landed here.
 */
export function RoleUpgradeGate({ dict }: { dict: RoleUpgradeDict }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleYes() {
    setBusy(true);
    const res = await confirmClinicRoleAdd();
    if (res.ok) {
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  function handleNo() {
    setBusy(true);
    router.push("/patient");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-7 shadow-xl">
        <div className="mb-4 flex items-center gap-2.5">
          <Logo showText={false} size={22} />
          <h2 className="text-[20px]">{dict.title}</h2>
        </div>
        <p className="text-[14.5px] leading-relaxed text-ink-soft">{dict.body}</p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleYes}
            disabled={busy}
            className="w-full rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60"
          >
            {dict.yes}
          </button>
          <button
            type="button"
            onClick={handleNo}
            disabled={busy}
            className="w-full rounded-xl border border-line bg-surface px-5 py-3 text-[14px] font-semibold text-ink transition-all hover:border-brand-line disabled:cursor-not-allowed disabled:opacity-50"
          >
            {dict.no}
          </button>
        </div>
      </div>
    </div>
  );
}
