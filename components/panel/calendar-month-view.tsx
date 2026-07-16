"use client";

import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import { TZ, tzDateParts } from "@/lib/calendar/client-date";
import type { WeekBookingVM } from "@/components/panel/calendar-grid-view";

const MAX_CHIPS_PER_DAY = 3;

interface MonthDay {
  year: number;
  month: number;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
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
  dict,
  onSelectDay,
}: {
  gridStart: Date; // Monday 00:00 UTC-instant of the first displayed week
  currentMonth: number; // 1-12, the month being viewed (for dimming padding days)
  bookings: WeekBookingVM[];
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
    days.push({
      year, month, day,
      inCurrentMonth: month === currentMonth,
      isToday: year === todayKey.year && month === todayKey.month && day === todayKey.day,
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
              className={`flex min-h-[92px] flex-col items-stretch gap-1 border-b border-r border-line p-1.5 text-left last:border-r-0 hover:bg-surface-2/40 [&:nth-child(7n)]:border-r-0 ${
                d.inCurrentMonth ? "bg-surface" : "bg-surface-2/30"
              }`}
            >
              <span
                className={`self-start rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold ${
                  d.isToday ? "bg-brand text-white" : d.inCurrentMonth ? "text-ink" : "text-ink-soft/60"
                }`}
              >
                {d.day}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayBookings.slice(0, MAX_CHIPS_PER_DAY).map((b) => (
                  <div
                    key={b.id}
                    className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                      b.status === "pending_confirmation" ? "bg-orange-100 text-orange-700" : "bg-brand-weak text-brand-ink"
                    }`}
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
