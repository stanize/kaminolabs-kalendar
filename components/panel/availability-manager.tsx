"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { saveAvailability, type WeekHours } from "@/lib/actions/availability";
import {
  WEEKDAY_ORDER,
  TIME_OPTIONS,
  DEFAULT_RANGE_START,
  addMinutes,
  validateDayRanges,
  BOOKING_WINDOW_OPTIONS,
  type TimeRange,
} from "@/lib/availability/constants";
import type { DayId } from "@/lib/onboarding/types";
import type { AvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";

type WeekState = Record<DayId, TimeRange[]>;

function tmpl(s: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);
}

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
  dict,
}: {
  initialWeek: WeekHours;
  hasSavedHours: boolean;
  bookingWindowMonths: number;
  returnToHome: boolean;
  dict: AvailabilityDictionary;
}) {
  const router = useRouter();
  const m = dict.manager;
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
      const v = validateDayRanges(week[day], dict.validation);
      if (!v.valid) {
        setError(tmpl(m.rangeAt, { day: dict.weekdays[day], error: v.error }));
        return;
      }
    }

    setSaving(true);
    try {
      const result = await saveAvailability({
        week,
        bookingWindowMonths: windowMonths,
        dict: { action: dict.errors, validation: dict.validation },
      });
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
      setError(m.errUnexpected);
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

      {/* Weekly grid + booking window — one container */}
      <div className="rounded-xl border border-line bg-surface">
        {WEEKDAY_ORDER.map((day, di) => {
          const ranges = week[day];
          const open = ranges.length > 0;
          return (
            <div
              key={day}
              className={`flex gap-3 px-4 py-3 ${di > 0 ? "border-t border-line" : ""}`}
            >
              {/* Day toggle + label — pinned to the first range's row */}
              <label className="flex h-[42px] w-[130px] shrink-0 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={open}
                  onChange={(e) => toggleDay(day, e.target.checked)}
                  className="h-4 w-4 accent-brand"
                />
                <span className={`text-[14px] font-semibold ${open ? "text-ink" : "text-ink-soft"}`}>
                  {dict.weekdays[day]}
                </span>
              </label>

              {/* Right side: closed label, or the ranges (first inline, extras stacked) */}
              {!open ? (
                <div className="flex h-[42px] items-center text-[13px] text-ink-soft">{m.closed}</div>
              ) : (
                <div className="flex flex-1 flex-col gap-2">
                  {ranges.map((r, i) => (
                    <div key={i} className="flex h-[42px] items-center gap-2">
                      <TimeSelect value={r.start} onChange={(v) => updateRange(day, i, { start: v })} />
                      <span className="text-[13px] text-ink-soft">a</span>
                      <TimeSelect value={r.end} onChange={(v) => updateRange(day, i, { end: v })} />
                      <button
                        onClick={() => removeRange(day, i)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                        aria-label={m.removeRange}
                      >
                        <Icon name="x" size={15} />
                      </button>
                      {/* "Añadir franja" sits at the end of the first row */}
                      {i === 0 && (
                        <button
                          onClick={() => addRange(day)}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-brand hover:bg-brand-weak"
                        >
                          <Icon name="plus" size={14} /> {m.addRange}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Blank space after the last day so Sat/Sun dropdowns open cleanly,
            then the booking window + confirm — all in the same container. */}
        <div className="border-t border-line px-4 pb-4 pt-6 mt-4">
          {saved && !error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-line bg-brand-weak px-4 py-3 text-[13.5px] text-brand-ink">
              <Icon name="check" size={16} strokeWidth={2.5} className="shrink-0" />
              <span>{m.saved}</span>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-[7px]">
              <span className="text-[13px] font-semibold text-ink">{m.bookingWindowQuestion}</span>
              <div className="flex gap-2">
                {BOOKING_WINDOW_OPTIONS.map((wm) => (
                  <button
                    key={wm}
                    type="button"
                    onClick={() => { setWindowMonths(wm); setSaved(false); }}
                    className={`rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-all ${
                      windowMonths === wm
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-surface text-ink-soft hover:border-brand-line hover:text-ink"
                    }`}
                  >
                    {wm} {wm === 1 ? m.month : m.months}
                  </button>
                ))}
              </div>
            </div>
            <Btn onClick={handleSave} disabled={saving} size="lg">
              {saving ? m.confirming : m.confirmButton}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // When opening, anchor the selected option near the TOP of the list (with a
  // little context above it) instead of the browser-default bottom anchoring.
  useEffect(() => {
    if (!open || !listRef.current || !selectedRef.current) return;
    const list = listRef.current;
    const sel = selectedRef.current;
    list.scrollTop = Math.max(0, sel.offsetTop - 8);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-[92px] items-center justify-between rounded-[10px] border bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-all ${
          open ? "border-brand shadow-[0_0_0_3px_var(--color-brand-weak)]" : "border-line hover:border-brand-line"
        }`}
      >
        {value}
        <Icon name="chevronDown" size={14} className="text-ink-soft" />
      </button>
      {open && (
        <div
          ref={listRef}
          className="absolute z-20 mt-1 max-h-[240px] w-[92px] overflow-y-auto rounded-[10px] border border-line bg-surface py-1 shadow-[0_12px_40px_rgba(15,31,46,.12)]"
        >
          {TIME_OPTIONS.map((t) => {
            const isSel = t === value;
            return (
              <button
                key={t}
                ref={isSel ? selectedRef : undefined}
                type="button"
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1.5 text-left text-[14px] transition-colors ${
                  isSel
                    ? "bg-brand text-white"
                    : "text-ink hover:bg-brand-weak"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
