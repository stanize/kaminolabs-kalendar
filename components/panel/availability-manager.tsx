"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { saveAvailability, type WeekHours } from "@/lib/actions/availability";
import {
  WEEKDAY_ORDER,
  weekdayLabel,
  TIME_OPTIONS,
  DEFAULT_RANGE_START,
  addMinutes,
  validateDayRanges,
  BOOKING_WINDOW_OPTIONS,
  type TimeRange,
} from "@/lib/availability/constants";
import type { DayId } from "@/lib/onboarding/types";

type WeekState = Record<DayId, TimeRange[]>;

// Mon–Fri 09:00–17:00, weekend closed — the pre-fill for a fresh setup.
function defaultWeek(): WeekState {
  const w = {} as WeekState;
  for (const d of WEEKDAY_ORDER) {
    w[d] = d === "sat" || d === "sun" ? [] : [{ start: "09:00", end: "17:00" }];
  }
  return w;
}

function normalize(initial: WeekHours): WeekState {
  const w = {} as WeekState;
  for (const d of WEEKDAY_ORDER) w[d] = initial[d] ? initial[d]!.map((r) => ({ ...r })) : [];
  return w;
}

export function AvailabilityManager({
  initialWeek,
  hasSavedHours,
  bookingWindowMonths,
  returnToHome,
}: {
  initialWeek: WeekHours;
  hasSavedHours: boolean;
  bookingWindowMonths: number;
  returnToHome: boolean;
}) {
  const router = useRouter();
  const [week, setWeek] = useState<WeekState>(
    hasSavedHours ? normalize(initialWeek) : defaultWeek()
  );
  const [windowMonths, setWindowMonths] = useState<number>(bookingWindowMonths || 1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setDay(day: DayId, ranges: TimeRange[]) {
    setWeek((w) => ({ ...w, [day]: ranges }));
    setSaved(false);
  }

  function toggleDay(day: DayId, open: boolean) {
    if (open) {
      setDay(day, [{ start: DEFAULT_RANGE_START, end: addMinutes(DEFAULT_RANGE_START, 60) }]);
    } else {
      setDay(day, []);
    }
  }

  function addRange(day: DayId) {
    const ranges = week[day];
    // New range starts at the previous range's end (or the default for the first).
    const start = ranges.length > 0 ? ranges[ranges.length - 1].end : DEFAULT_RANGE_START;
    setDay(day, [...ranges, { start, end: addMinutes(start, 60) }]);
  }

  function updateRange(day: DayId, index: number, patch: Partial<TimeRange>) {
    setDay(
      day,
      week[day].map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  function removeRange(day: DayId, index: number) {
    setDay(
      day,
      week[day].filter((_, i) => i !== index)
    );
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    // Client-side validation for immediate feedback (server re-validates).
    for (const day of WEEKDAY_ORDER) {
      const v = validateDayRanges(week[day]);
      if (!v.valid) {
        setError(`${weekdayLabel(day)}: ${v.error}`);
        return;
      }
    }

    setSaving(true);
    try {
      const result = await saveAvailability({ week, bookingWindowMonths: windowMonths });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setSaved(true);
      setSaving(false);
      // First-time setup from the home flow -> return to Inicio.
      if (returnToHome && !hasSavedHours) {
        router.push("/panel");
        return;
      }
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Weekly grid */}
      <div className="flex flex-col gap-2">
        {WEEKDAY_ORDER.map((day) => {
          const ranges = week[day];
          const open = ranges.length > 0;
          return (
            <div key={day} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(e) => toggleDay(day, e.target.checked)}
                    className="h-4 w-4 accent-brand"
                  />
                  <span className={`text-[14px] font-semibold ${open ? "text-ink" : "text-ink-soft"}`}>
                    {weekdayLabel(day)}
                  </span>
                </label>
                {!open && <span className="text-[13px] text-ink-soft">Cerrado</span>}
              </div>

              {open && (
                <div className="mt-3 flex flex-col gap-2 pl-[26px]">
                  {ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <TimeSelect
                        value={r.start}
                        onChange={(v) => updateRange(day, i, { start: v })}
                      />
                      <span className="text-[13px] text-ink-soft">a</span>
                      <TimeSelect
                        value={r.end}
                        onChange={(v) => updateRange(day, i, { end: v })}
                      />
                      <button
                        onClick={() => removeRange(day, i)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                        aria-label="Quitar franja"
                      >
                        <Icon name="x" size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addRange(day)}
                    className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-brand hover:bg-brand-weak"
                  >
                    <Icon name="plus" size={14} /> Añadir franja
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {saved && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-line bg-brand-weak px-4 py-3 text-[13.5px] text-brand-ink">
          <Icon name="check" size={16} strokeWidth={2.5} className="shrink-0" />
          <span>Guardado correctamente.</span>
        </div>
      )}

      {/* Booking window + confirm */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] font-semibold text-ink">¿Con cuánta antelación pueden reservar?</span>
          <div className="flex gap-2">
            {BOOKING_WINDOW_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setWindowMonths(m); setSaved(false); }}
                className={`rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-all ${
                  windowMonths === m
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-ink-soft hover:border-brand-line hover:text-ink"
                }`}
              >
                {m} {m === 1 ? "mes" : "meses"}
              </button>
            ))}
          </div>
        </div>
        <Btn onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Guardando…" : "Confirmar cambios"}
        </Btn>
      </div>
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)]"
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
