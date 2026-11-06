"use client";

import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { ClosureRuleVM } from "@/components/panel/appointment-modal";
import { TZ, tzDateParts } from "@/lib/calendar/client-date";
import type { WeekBookingVM, GridDayFestivo } from "@/components/panel/calendar-grid-view";
import { chipClasses } from "@/components/panel/calendar-grid-view";

const MAX_CHIPS_PER_DAY = 3;

interface MonthDay {
  year: number;
  month: number;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isFestivo: boolean;
  festivoLabel: string | null;
  // One-off (non-recurring) time off matching this date — clinic-wide or
  // for a specific provider. Shown as a small label, not a full hatch:
  // unlike festivo (always clinic-wide), a provider-specific absence
  // doesn't mean the whole day is closed, so this view (which has no
  // per-provider column) only flags it rather than implying closure.
  timeOffLabels: string[];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export function CalendarMonthView({
  gridStart,
  currentMonth,
  bookings,
  festivos = [],
  closures = [],
  dict,
  onSelectDay,
}: {
  gridStart: Date; // Monday 00:00 UTC-instant of the first displayed week
  currentMonth: number; // 1-12, the month being viewed (for dimming padding days)
  bookings: WeekBookingVM[];
  festivos?: GridDayFestivo[];
  closures?: ClosureRuleVM[];
  dict: CalendarDictionary;
  onSelectDay: (year: number, month: number, day: number) => void;
}) {
  const w = dict.week;
  const todayKey = tzDateParts(new Date());

  const days: MonthDay[] = [];
  for (let i = 0; i < 42; i++) {
    const anchor = new Date(gridStart);
    anchor.setUTCHours(anchor.getUTCHours() + 12);
    anchor.setUTCDate(anchor.getUTCDate() + i);
    const { year, month, day } = tzDateParts(anchor);
    const festivo = festivos.find((f) => f.month === month && f.day === day);
    const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
    const timeOffLabels = closures
      .filter((c) => !c.recurring && c.startDate && c.endDate && c.startDate <= dateStr && dateStr <= c.endDate)
      .map((c) => c.label)
      .filter((l): l is string => !!l);
    days.push({
      year, month, day,
      inCurrentMonth: month === currentMonth,
      isToday: year === todayKey.year && month === todayKey.month && day === todayKey.day,
      isFestivo: !!festivo,
      festivoLabel: festivo?.label ?? null,
      timeOffLabels,
    });
  }

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + i);
    return new Intl.DateTimeFormat(dict.intlLocale, { timeZone: TZ, weekday: "short" }).format(d);
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line">
        {weekdayLabels.map((label, i) => (
          <div key={i} className="border-r border-line px-2 py-2 text-center text-[11px] font-semibold capitalize text-ink-soft last:border-r-0">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const dayBookings = bookings
            .filter((b) => {
              const parts = tzDateParts(new Date(b.startIso));
              return parts.year === d.year && parts.month === d.month && parts.day === d.day;
            })
            .sort((a, b) => a.startIso.localeCompare(b.startIso));
          const overflow = dayBookings.length - MAX_CHIPS_PER_DAY;

          return (
            <button
              key={i}
              onClick={() => onSelectDay(d.year, d.month, d.day)}
              className={`relative flex min-h-[92px] flex-col items-stretch gap-1 overflow-hidden border-b border-r border-line p-1.5 text-left last:border-r-0 hover:bg-surface-2/40 [&:nth-child(7n)]:border-r-0 ${
                d.inCurrentMonth ? "bg-surface" : "bg-surface-2/30"
              }`}
            >
              {/* Festivo — same bold diagonal hatch as the week grid, so a
                  holiday reads identically in both views (Bea/Arun feedback
                  2026-11-06: make closed days unmistakable). */}
              {d.isFestivo && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(180,83,9,0.35) 0px, rgba(180,83,9,0.35) 7px, transparent 7px, transparent 16px)",
                  }}
                />
              )}
              <span
                className={`relative self-start rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold ${
                  d.isToday ? "bg-brand text-white" : d.inCurrentMonth ? "text-ink" : "text-ink-soft/60"
                }`}
              >
                {d.day}
              </span>
              {d.isFestivo && (
                <span className="relative truncate text-[10px] font-medium text-amber-700">
                  {d.festivoLabel || w.festivoFallbackLabel}
                </span>
              )}
              {!d.isFestivo && d.timeOffLabels.length > 0 && (
                <span className="relative truncate text-[10px] font-medium text-slate-600">
                  {d.timeOffLabels.join(", ")}
                </span>
              )}
              <div className="relative flex flex-col gap-0.5">
                {dayBookings.slice(0, MAX_CHIPS_PER_DAY).map((b) => (
                  <div
                    key={b.id}
                    className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${chipClasses(b.status, new Date(b.startIso) < new Date(), b.clientStatus, b.clinicReviewedAt)}`}
                  >
                    {timeLabel(b.startIso)} · {b.clientName}
                  </div>
                ))}
                {overflow > 0 && (
                  <div className="truncate px-1 text-[10px] font-semibold text-ink-soft">
                    {w.moreTemplate.replace("{n}", String(overflow))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
