"use client";

import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { TimeSelect } from "@/components/panel/time-select";
import { WEEKDAY_ORDER, addMinutes, type TimeRange } from "@/lib/availability/constants";
import type { DayId } from "@/lib/onboarding/types";
import type { AvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";

/** The two wizard-owned steps. Step 3 ("review") is the normal editor grid,
 *  rendered by AvailabilityManager itself with a review banner. */
export type WizardStep = "days" | "hours";

function tmpl(s: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);
}

/**
 * First-time availability setup, steps 1–2: pick open days, then define the
 * standard hours applied to all of them. Fully controlled — all state lives in
 * AvailabilityManager so navigating back from the review grid preserves it.
 * The wizard is only a fast entry path: once it fans out, every day is an
 * independent schedule (no linked template concept).
 */
export function AvailabilitySetupWizard({
  step,
  selectedDays,
  onToggleDay,
  ranges,
  onRangesChange,
  onBack,
  onNext,
  dict,
}: {
  step: WizardStep;
  selectedDays: ReadonlySet<DayId>;
  onToggleDay: (day: DayId) => void;
  ranges: TimeRange[];
  onRangesChange: (ranges: TimeRange[]) => void;
  onBack: () => void;
  onNext: () => void;
  dict: AvailabilityDictionary;
}) {
  const w = dict.wizard;
  const stepIndex = step === "days" ? 1 : 2;

  function updateRange(index: number, patch: Partial<TimeRange>) {
    onRangesChange(ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRange() {
    const start = ranges.length > 0 ? ranges[ranges.length - 1].end : "09:00";
    onRangesChange([...ranges, { start, end: addMinutes(start, 60) }]);
  }

  function removeRange(index: number) {
    onRangesChange(ranges.filter((_, i) => i !== index));
  }

  const count = selectedDays.size;
  const subtitle =
    step === "days"
      ? w.daysSubtitle
      : count === 1
        ? w.hoursSubtitleOne
        : tmpl(w.hoursSubtitle, { count: String(count) });

  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      {/* Step badge + progress bar */}
      <div className="mb-4 flex items-center gap-3">
        <span className="shrink-0 rounded-full bg-brand-weak px-3 py-1 text-[12px] font-semibold text-brand-ink">
          {tmpl(w.stepLabel, { n: String(stepIndex), total: "3" })}
        </span>
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${(stepIndex / 3) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="mb-1 text-[18px] font-semibold text-ink">
        {step === "days" ? w.daysTitle : w.hoursTitle}
      </h2>
      <p className="mb-5 text-[13.5px] text-ink-soft">{subtitle}</p>

      {step === "days" ? (
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_ORDER.map((day) => {
            const selected = selectedDays.has(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => onToggleDay(day)}
                aria-pressed={selected}
                className={`w-[64px] rounded-[10px] border py-2.5 text-[14px] font-semibold transition-all ${
                  selected
                    ? "border-brand bg-brand-weak text-brand-ink"
                    : "border-line bg-surface text-ink-soft hover:border-brand-line hover:text-ink"
                }`}
              >
                {dict.weekdaysShort[day]}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ranges.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 sm:h-[42px] sm:flex-nowrap">
              <TimeSelect value={r.start} onChange={(v) => updateRange(i, { start: v })} />
              <span className="text-[13px] text-ink-soft">{dict.manager.rangeJoiner}</span>
              <TimeSelect value={r.end} onChange={(v) => updateRange(i, { end: v })} />
              {/* The last remaining range can't be deleted — with zero ranges
                  the step would mean "closed everywhere", which contradicts
                  having selected open days in step 1. */}
              {ranges.length > 1 && (
                <button
                  onClick={() => removeRange(i)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                  aria-label={dict.manager.removeRange}
                >
                  <Icon name="x" size={15} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addRange}
            className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-brand hover:bg-brand-weak"
          >
            <Icon name="plus" size={14} /> {dict.manager.addRange}
          </button>
        </div>
      )}

      <div
        className={`mt-6 flex items-center ${step === "days" ? "justify-end" : "justify-between"}`}
      >
        {step === "hours" && (
          <Btn variant="ghost" onClick={onBack}>
            {w.back}
          </Btn>
        )}
        <Btn onClick={onNext}>{w.next}</Btn>
      </div>
    </div>
  );
}
