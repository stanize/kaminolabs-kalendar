"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { skipOnboarding } from "@/lib/actions/skip-onboarding";

export function NavBtns({
  paso,
  canNext,
  next,
  back,
  loading,
  errorMsg,
}: {
  paso: number;
  canNext: boolean;
  next: () => void;
  back: () => void;
  loading?: boolean;
  errorMsg?: string | null;
}) {
  const router = useRouter();
  const [skipping, setSkipping] = useState(false);

  if (paso === 0) return null;

  async function handleMasTarde() {
    setSkipping(true);
    await skipOnboarding();
    router.push("/panel");
  }

  return (
    <div className="mt-[26px] border-t border-line pt-[22px]">
      {errorMsg && (
        <p className="mb-3 rounded-[10px] bg-error-weak px-3.5 py-2.5 text-[13.5px] font-medium text-error">
          {errorMsg}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Btn variant="ghost" onClick={back} disabled={loading || skipping}>
            <Icon name="chevronLeft" size={17} /> Atrás
          </Btn>
          <button
            type="button"
            onClick={handleMasTarde}
            disabled={skipping}
            className="cursor-pointer text-[13.5px] font-medium text-ink-soft underline-offset-2 transition-colors duration-150 hover:text-ink hover:underline disabled:cursor-wait disabled:opacity-50"
          >
            {skipping ? "Redirigiendo…" : "Más tarde"}
          </button>
        </div>
        <Btn onClick={next} disabled={!canNext || loading || skipping}>
          {loading ? "Creando…" : paso === 4 ? "Crear mi página" : "Continuar"}
          {!loading && <Icon name="arrowRight" size={17} />}
        </Btn>
      </div>
    </div>
  );
}
