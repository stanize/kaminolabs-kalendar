"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { updateCancellationWindow } from "@/lib/actions/settings";
import { reportClientError } from "@/lib/report-client-error";

// Preset options plus a free-entry fallback — mirrors the pattern used for
// booking_window_months (a small fixed set of sensible choices) rather than
// a raw unbounded number input, since most clinics will want a round value.
const PRESETS = [0, 12, 24, 48, 72] as const;

export function CancellationWindowForm({ initialHours }: { initialHours: number }) {
  const router = useRouter();
  const isPreset = (PRESETS as readonly number[]).includes(initialHours);

  const [hours, setHours] = useState(initialHours);
  const [customMode, setCustomMode] = useState(!isPreset);
  const [customValue, setCustomValue] = useState(String(initialHours));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(value: number) {
    setError(null);
    setSaved(false);

    if (!Number.isInteger(value) || value < 0 || value > 720) {
      setError("Introduce un número de horas válido (entre 0 y 720).");
      return;
    }

    setSaving(true);
    try {
      const result = await updateCancellationWindow(value);
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setHours(value);
      setSaving(false);
      setSaved(true);
      router.refresh();
    } catch (e) {
      reportClientError("updateCancellationWindow", e);
      setError("No se pudo guardar el ajuste.");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-[15px] font-semibold text-ink">Ventana de cancelación</h2>
      <p className="mt-1.5 text-[13.5px] text-ink-soft">
        Cuánto tiempo antes de una cita tus clientes pueden cancelarla ellos mismos, sin tu
        aprobación. Fuera de esta ventana, la cancelación es inmediata como hasta ahora.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              setCustomMode(false);
              handleSave(preset);
            }}
            disabled={saving}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60 ${
              !customMode && hours === preset
                ? "border-brand bg-brand-weak text-brand-ink"
                : "border-line text-ink-soft hover:bg-surface-2"
            }`}
          >
            {preset === 0 ? "Sin ventana" : `${preset}h`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomMode(true)}
          disabled={saving}
          className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60 ${
            customMode
              ? "border-brand bg-brand-weak text-brand-ink"
              : "border-line text-ink-soft hover:bg-surface-2"
          }`}
        >
          Personalizado
        </button>
      </div>

      {customMode && (
        <div className="mt-4 flex items-end gap-3">
          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-ink-soft">Horas</label>
            <input
              type="number"
              min={0}
              max={720}
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="w-28 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink focus:border-brand focus:outline-none"
            />
          </div>
          <Btn
            onClick={() => handleSave(Number(customValue))}
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar"}
          </Btn>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && !error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-line bg-brand-weak px-4 py-3 text-[13.5px] text-brand-ink">
          <Icon name="check" size={16} strokeWidth={2.5} />
          <span>Ajuste guardado.</span>
        </div>
      )}
    </div>
  );
}
