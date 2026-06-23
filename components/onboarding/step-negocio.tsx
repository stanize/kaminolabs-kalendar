"use client";

import clsx from "clsx";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { TIPOS } from "@/lib/onboarding/data";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { TipoNegocio } from "@/lib/onboarding/types";

export function StepNegocio() {
  const negocio = useOnboardingStore((s) => s.d.negocio);
  const setNegocioNombre = useOnboardingStore((s) => s.setNegocioNombre);
  const setNegocioTipo = useOnboardingStore((s) => s.setNegocioTipo);
  const setNegocioCiudad = useOnboardingStore((s) => s.setNegocioCiudad);

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Nombre del negocio"
        placeholder="Centro Bienestar Serena"
        value={negocio.nombre}
        onChange={(e) => setNegocioNombre(e.target.value)}
      />

      <div className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">¿A qué te dedicas?</span>
        <div className="grid grid-cols-2 gap-[9px] max-[520px]:grid-cols-1">
          {TIPOS.map((tp) => {
            const seleccionado = negocio.tipo === tp.id;
            return (
              <button
                key={tp.id}
                type="button"
                onClick={() => setNegocioTipo(tp.id as TipoNegocio)}
                className={clsx(
                  "relative flex items-center gap-2.5 rounded-xl border px-3.5 py-[13px] text-left text-[14px] font-semibold transition-all duration-150",
                  seleccionado
                    ? "border-brand bg-brand-weak text-brand-ink"
                    : "border-line bg-surface text-ink hover:border-brand-line"
                )}
              >
                <Icon name={tp.icon} size={18} />
                {tp.label}
                {seleccionado && (
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
        value={negocio.ciudad}
        onChange={(e) => setNegocioCiudad(e.target.value)}
      />
    </div>
  );
}
