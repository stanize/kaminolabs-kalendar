"use client";

import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import type { PanelShellDictionary } from "@/lib/i18n/dictionaries/panel-shell";

type RoleUpgradeDict = PanelShellDictionary["roleUpgrade"];

/**
 * Shown instead of the panel when a signed-in user holds the 'patient' role
 * but not 'clinic' yet. Per the 2026-09-14 no-self-service-dual-role-accounts
 * decision (workflows/clinic-onboarding.md), this account is NEVER silently
 * (or self-service) promoted to clinic just because it landed here — there's
 * no "add this role too" option any more, only a redirect back to the
 * account's actual portal. A second role is granted only by Arun, manually,
 * from a support ticket (admin-portal-tools.md's manual-role-grant-tool).
 */
export function RoleUpgradeGate({ dict }: { dict: RoleUpgradeDict }) {
  const router = useRouter();

  function handleGoToAccount() {
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
            onClick={handleGoToAccount}
            className="w-full rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand/90"
          >
            {dict.action}
          </button>
        </div>
      </div>
    </div>
  );
}
