"use client";

import { Icon } from "@/components/ui/icon";
import { PLANTILLAS } from "@/lib/onboarding/data";
import { useOnboardingStore } from "@/lib/onboarding/store";

export function StepServicios() {
  const negocio = useOnboardingStore((s) => s.d.negocio);
  const servicios = useOnboardingStore((s) => s.d.servicios);
  const addServicio = useOnboardingStore((s) => s.addServicio);
  const updateServicio = useOnboardingStore((s) => s.updateServicio);
  const removeServicio = useOnboardingStore((s) => s.removeServicio);

  const sugeridos = PLANTILLAS[negocio.tipo || "otro"] ?? PLANTILLAS.otro;
  const yaTengo = new Set(servicios.map((s) => s.nombre));
  const pendientes = sugeridos.filter((s) => !yaTengo.has(s[0]));

  return (
    <div className="flex flex-col gap-4">
      {pendientes.length > 0 && (
        <div className="rounded-xl bg-surface-2 p-3.5">
          <span className="mb-2.5 block text-[11.5px] font-bold uppercase tracking-[.04em] text-ink-soft">
            Sugerencias para ti
          </span>
          <div className="flex flex-wrap gap-2">
            {pendientes.map(([nombre, min, precio]) => (
              <button
                key={nombre}
                type="button"
                onClick={() => addServicio(nombre, min, precio)}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-[7px] text-[13px] font-semibold text-brand-ink transition-all duration-150 hover:border-brand-line hover:bg-brand-weak"
              >
                <Icon name="plus" size={14} /> {nombre} · {precio} €
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {servicios.map((s) => (
          <div key={s.id} className="flex flex-col gap-[11px] rounded-xl border border-line bg-surface p-3.5">
            <input
              value={s.nombre}
              onChange={(e) => updateServicio(s.id, { nombre: e.target.value })}
              placeholder="Nombre del servicio"
              className="border-0 border-b border-line bg-transparent px-0 py-[5px] text-[15px] font-semibold text-ink outline-none transition-colors duration-150 focus:border-brand"
            />
            <div className="flex items-center gap-2.5">
              <select
                value={s.min}
                onChange={(e) => updateServicio(s.id, { min: Number(e.target.value) })}
                className="cursor-pointer rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13.5px] font-semibold text-ink outline-none focus:border-brand"
              >
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
              <div className="flex items-center rounded-[9px] border border-line bg-surface px-[11px]">
                <input
                  type="number"
                  min={0}
                  value={s.precio}
                  onChange={(e) => updateServicio(s.id, { precio: Number(e.target.value) })}
                  className="w-[54px] border-0 bg-transparent py-2 text-right text-[14px] font-semibold text-ink outline-none"
                />
                <span className="ml-[3px] text-ink-soft">€</span>
              </div>
              <button
                type="button"
                onClick={() => removeServicio(s.id)}
                aria-label="Eliminar servicio"
                className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] border border-line bg-surface text-ink-soft transition-all duration-150 hover:border-error hover:text-error"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => addServicio()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-line bg-transparent p-3 text-[14.5px] font-semibold text-brand-ink transition-all duration-150 hover:border-brand-line hover:bg-brand-weak"
      >
        <Icon name="plus" size={17} /> Añadir servicio
      </button>

      {servicios.length === 0 && (
        <p className="m-0 text-[13px] text-ink-soft">
          Añade al menos un servicio para que tus clientes puedan reservar.
        </p>
      )}
    </div>
  );
}
