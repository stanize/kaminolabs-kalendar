"use client";

import clsx from "clsx";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { BUSINESS_TYPES } from "@/lib/onboarding/data";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { BusinessType } from "@/lib/onboarding/types";

export function StepNegocio() {
  const business         = useOnboardingStore((s) => s.d.business);
  const setBusinessName  = useOnboardingStore((s) => s.setBusinessName);
  const setBusinessType  = useOnboardingStore((s) => s.setBusinessType);
  const setBusinessCity  = useOnboardingStore((s) => s.setBusinessCity);

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Nombre del negocio"
        placeholder="Centro Bienestar Serena"
        value={business.name}
        onChange={(e) => setBusinessName(e.target.value)}
      />

      <div className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">¿A qué te dedicas?</span>
        <div className="grid grid-cols-2 gap-[9px] max-[520px]:grid-cols-1">
          {BUSINESS_TYPES.map((bt) => {
            const selected = business.type === bt.id;
            return (
              <button
                key={bt.id}
                type="button"
                onClick={() => setBusinessType(bt.id as BusinessType)}
                className={clsx(
                  "relative flex items-center gap-2.5 rounded-xl border px-3.5 py-[13px] text-left text-[14px] font-semibold transition-all duration-150",
                  selected
                    ? "border-brand bg-brand-weak text-brand-ink"
                    : "border-line bg-surface text-ink hover:border-brand-line"
                )}
              >
                <Icon name={bt.icon} size={18} />
                {bt.label}
                {selected && (
                  <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
                    <Icon name="check" size={13} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Field
        label="Ciudad"
        hint="(opcional)"
        placeholder="Madrid"
        value={business.city}
        onChange={(e) => setBusinessCity(e.target.value)}
      />
    </div>
  );
}
