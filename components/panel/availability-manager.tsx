"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { SaveOverlay, useSaveOverlay } from "@/components/panel/save-overlay";
import { TimeSelect } from "@/components/panel/time-select";
import {
  AvailabilitySetupWizard,
  type WizardStep,
} from "@/components/panel/availability-setup-wizard";
import { saveAvailability, type WeekHours } from "@/lib/actions/availability";
import {
  WEEKDAY_ORDER,
  DEFAULT_RANGE_START,
  SETUP_DEFAULT_DAYS,
  SETUP_DEFAULT_RANGES,
  addMinutes,
  validateDayRanges,
  BOOKING_WINDOW_OPTIONS,
  type TimeRange,
} from "@/lib/availability/constants";
import type { DayId } from "@/lib/onboarding/types";
import type { AvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";

type WeekState = Record<DayId, TimeRange[]>;

/** Position in the first-setup flow. Users with saved hours are always at
 *  "review" (which renders as the plain editor, no wizard, no banner). */
type SetupStep = WizardStep | "review";

function tmpl(s: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);
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
  const wz = dict.wizard;

  // First-time setup runs a 3-step wizard: pick open days -> define standard
  // hours -> review. The review step IS the normal editor grid, pre-filled by
  // fanning the standard hours out to every selected day. After the fan-out,
  // days are fully independent schedules — the wizard is only a fast entry
  // path, not a linked template (there is no template concept in the model).
  const isFirstSetup = !hasSavedHours;
  const [step, setStep] = useState<SetupStep>(isFirstSetup ? "days" : "review");
  const [wizardDays, setWizardDays] = useState<Set<DayId>>(() => new Set(SETUP_DEFAULT_DAYS));
  const [wizardRanges, setWizardRanges] = useState<TimeRange[]>(() =>
    SETUP_DEFAULT_RANGES.map((r) => ({ ...r }))
  );

  const [week, setWeek] = useState<WeekState>(() => normalize(initialWeek));
  const [windowMonths, setWindowMonths] = useState<number>(bookingWindowMonths || 1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Full-screen save overlay (shared setup-page pattern): gray out while
  // saving, flash success, then redirect/refresh. Replaces the old inline
  // "saved" banner.
  const { overlay, setOverlay, flashSuccessThen } = useSaveOverlay();

  function toggleWizardDay(day: DayId) {
    setWizardDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function handleWizardNext() {
    setError(null);
    if (step === "days") {
      if (wizardDays.size === 0) {
        setError(wz.errNoDays);
        return;
      }
      setStep("hours");
      return;
    }
    // step === "hours": validate the standard ranges, then fan out to the
    // selected days and land on the review grid.
    const v = validateDayRanges(wizardRanges, dict.validation);
    if (!v.valid) {
      setError(v.error);
      return;
    }
    const next = {} as WeekState;
    for (const d of WEEKDAY_ORDER) {
      next[d] = wizardDays.has(d) ? wizardRanges.map((r) => ({ ...r })) : [];
    }
    setWeek(next);
    setStep("review");
  }

  function handleWizardBack() {
    setError(null);
    // From review back to hours: wizard state is preserved (it lives here),
    // but any per-day edits made on the review grid are discarded — advancing
    // again re-fans the standard hours. Predictable over clever.
    if (step === "review") setStep("hours");
    else if (step === "hours") setStep("days");
  }

  function setDay(day: DayId, ranges: TimeRange[]) {
    setWeek((w) => ({ ...w, [day]: ranges }));
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

    // Client-side validation for immediate feedback (server re-validates).
    for (const day of WEEKDAY_ORDER) {
      const v = validateDayRanges(week[day], dict.validation);
      if (!v.valid) {
        setError(tmpl(m.rangeAt, { day: dict.weekdays[day], error: v.error }));
        return;
      }
    }

    setSaving(true);
    setOverlay("saving");
    try {
      const result = await saveAvailability({
        week,
        bookingWindowMonths: windowMonths,
        dict: { action: dict.errors, validation: dict.validation },
      });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        setOverlay(null);
        return;
      }
      flashSuccessThen(() => {
        // First-time setup from the home flow -> return to Inicio. Keep the
        // overlay up through the redirect so this page never flashes through.
        if (returnToHome && !hasSavedHours) {
          router.push("/panel");
          return;
        }
        setSaving(false);
        setOverlay(null);
        router.refresh();
      });
    } catch {
      setError(m.errUnexpected);
      setSaving(false);
      setOverlay(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SaveOverlay state={overlay} savingLabel={m.confirming} successLabel={m.saved} />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step !== "review" ? (
        <AvailabilitySetupWizard
          step={step}
          selectedDays={wizardDays}
          onToggleDay={toggleWizardDay}
          ranges={wizardRanges}
          onRangesChange={setWizardRanges}
          onBack={handleWizardBack}
          onNext={handleWizardNext}
          dict={dict}
        />
      ) : (
        <>
          {/* Review banner — first setup only. Step 3 of the wizard is simply
              the normal grid below, so users learn the editor for free. */}
          {isFirstSetup && (
            <div className="rounded-xl border border-line bg-surface px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="shrink-0 rounded-full bg-brand-weak px-3 py-1 text-[12px] font-semibold text-brand-ink">
                  {tmpl(wz.stepLabel, { n: "3", total: "3" })}
                </span>
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full w-full rounded-full bg-brand" />
                </div>
              </div>
              <h2 className="mt-3 text-[18px] font-semibold text-ink">{wz.reviewTitle}</h2>
              <p className="text-[13.5px] text-ink-soft">{wz.reviewSubtitle}</p>
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
                  className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:gap-3 ${di > 0 ? "border-t border-line" : ""}`}
                >
                  {/* Day toggle + label — pinned to the first range's row on sm+ */}
                  <label className="flex h-[28px] w-full shrink-0 cursor-pointer items-center gap-2.5 sm:h-[42px] sm:w-[130px]">
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
                    <div className="flex h-[28px] items-center text-[13px] text-ink-soft sm:h-[42px]">{m.closed}</div>
                  ) : (
                    <div className="flex flex-1 flex-col gap-2">
                      {ranges.map((r, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 sm:h-[42px] sm:flex-nowrap">
                          <TimeSelect value={r.start} onChange={(v) => updateRange(day, i, { start: v })} />
                          <span className="text-[13px] text-ink-soft">{m.rangeJoiner}</span>
                          <TimeSelect value={r.end} onChange={(v) => updateRange(day, i, { end: v })} />
                          <button
                            onClick={() => removeRange(day, i)}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                            aria-label={m.removeRange}
                          >
                            <Icon name="x" size={15} />
                          </button>
                          {/* "Añadir franja" sits at the end of the first row; wraps
                              to its own line on narrow screens if needed. */}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-[7px]">
                  <span className="text-[13px] font-semibold text-ink">{m.bookingWindowQuestion}</span>
                  <div className="flex gap-2">
                    {BOOKING_WINDOW_OPTIONS.map((wm) => (
                      <button
                        key={wm}
                        type="button"
                        onClick={() => setWindowMonths(wm)}
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
                <div className="flex items-center gap-2">
                  {isFirstSetup && (
                    <Btn variant="ghost" onClick={handleWizardBack} disabled={saving}>
                      {wz.back}
                    </Btn>
                  )}
                  <Btn onClick={handleSave} disabled={saving} size="lg">
                    {saving ? m.confirming : isFirstSetup ? wz.finishButton : m.confirmButton}
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
