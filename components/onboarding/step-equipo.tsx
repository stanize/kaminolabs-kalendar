"use client";

import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { useOnboardingStore } from "@/lib/onboarding/store";

export function StepEquipo() {
  const equipo = useOnboardingStore((s) => s.d.equipo);
  const updateMiembro = useOnboardingStore((s) => s.updateMiembro);
  const addMiembro = useOnboardingStore((s) => s.addMiembro);
  const removeMiembro = useOnboardingStore((s) => s.removeMiembro);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        {equipo.map((m, i) => (
          <div key={i} className="flex items-center gap-[11px] rounded-xl border border-line bg-surface p-3">
            <Avatar nombre={m.nombre} size={40} />
            <input
              value={m.nombre}
              onChange={(e) => updateMiembro(i, { nombre: e.target.value })}
              placeholder="Nombre"
              className="min-w-0 flex-1 border-0 border-b border-line bg-transparent py-1.5 text-[14.5px] font-semibold text-ink outline-none focus:border-brand"
            />
            <input
              value={m.rol}
              onChange={(e) => updateMiembro(i, { rol: e.target.value })}
              placeholder="Rol (ej. Psicóloga)"
              className="min-w-0 flex-1 border-0 border-b border-line bg-transparent py-1.5 text-[14px] text-ink-soft outline-none focus:border-brand"
            />
            {m.owner ? (
              <span className="whitespace-nowrap rounded-full bg-brand-weak px-[11px] py-[5px] text-[12px] font-bold text-brand-ink">
                Tú
              </span>
            ) : (
              <button
                type="button"
                onClick={() => removeMiembro(i)}
                aria-label="Eliminar miembro"
                className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] border border-line bg-surface text-ink-soft transition-all duration-150 hover:border-error hover:text-error"
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addMiembro}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-line bg-transparent p-3 text-[14.5px] font-semibold text-brand-ink transition-all duration-150 hover:border-brand-line hover:bg-brand-weak"
      >
        <Icon name="plus" size={17} /> Añadir miembro del equipo
      </button>

      <p className="m-0 text-[13px] text-ink-soft">
        ¿Trabajas en solitario? Perfecto: deja solo tu nombre y listo.
      </p>
    </div>
  );
}
