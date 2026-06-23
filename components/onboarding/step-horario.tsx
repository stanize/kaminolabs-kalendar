"use client";

import clsx from "clsx";
import { DIAS, HORAS } from "@/lib/onboarding/data";
import { useOnboardingStore } from "@/lib/onboarding/store";

export function StepHorario() {
  const horario = useOnboardingStore((s) => s.d.horario);
  const setHorarioDia = useOnboardingStore((s) => s.setHorarioDia);

  return (
    <div className="flex flex-col gap-1">
      {DIAS.map((dia) => {
        const h = horario[dia.id];
        return (
          <div
            key={dia.id}
            className={clsx(
              "flex items-center gap-3.5 rounded-[11px] border border-transparent px-3 py-[11px]",
              h.on && "border-line bg-surface"
            )}
          >
            <label className="relative inline-flex h-5 w-[34px] shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={h.on}
                onChange={(e) => setHorarioDia(dia.id, { on: e.target.checked })}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded-full bg-line transition-colors duration-200 peer-checked:bg-brand" />
              <span className="absolute left-[3px] top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-transform duration-200 peer-checked:translate-x-3.5" />
            </label>

            <span className="flex-1 text-[14.5px] font-semibold">{dia.label}</span>

            {h.on ? (
              <div className="flex items-center gap-2 text-[13px] text-ink-soft">
                <select
                  value={h.desde}
                  onChange={(e) => setHorarioDia(dia.id, { desde: e.target.value })}
                  className="cursor-pointer rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13.5px] font-semibold text-ink outline-none focus:border-brand"
                >
                  {HORAS.map((hora) => (
                    <option key={hora} value={hora}>
                      {hora}
                    </option>
                  ))}
                </select>
                <span>a</span>
                <select
                  value={h.hasta}
                  onChange={(e) => setHorarioDia(dia.id, { hasta: e.target.value })}
                  className="cursor-pointer rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13.5px] font-semibold text-ink outline-none focus:border-brand"
                >
                  {HORAS.map((hora) => (
                    <option key={hora} value={hora}>
                      {hora}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-[13.5px] font-medium text-ink-soft">Cerrado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
