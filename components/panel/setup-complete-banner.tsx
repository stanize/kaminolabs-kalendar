"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { dismissSetupComplete } from "@/lib/actions/onboarding";

export function SetupCompleteBanner() {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  if (hidden) return null;

  async function dismiss() {
    setBusy(true);
    setHidden(true); // optimistic
    try {
      const result = await dismissSetupComplete();
      if (!result.ok) {
        setHidden(false); // restore on failure
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setHidden(false);
      setBusy(false);
    }
  }

  return (
    <div className="relative mb-6 flex items-center gap-3 rounded-2xl border border-brand-line bg-brand-weak px-5 py-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white">
        <Icon name="check" size={18} strokeWidth={2.5} />
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-brand-ink">¡Todo configurado!</p>
        <p className="text-[13px] text-brand-ink/80">
          Tu página de reservas está lista para recibir clientes.
        </p>
      </div>
      <button
        onClick={dismiss}
        disabled={busy}
        aria-label="Descartar"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-brand-ink/70 transition-colors hover:bg-brand/10 hover:text-brand-ink disabled:opacity-50"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
