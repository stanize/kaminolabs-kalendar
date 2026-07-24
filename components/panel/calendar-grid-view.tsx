"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { DayId } from "@/lib/onboarding/types";
import { AppointmentModal, type SlotSelection } from "@/components/panel/appointment-modal";
import {
  TZ,
  tzDateParts,
  dayIdInTz,
  zonedTimeToUtc,
  minutesInTz,
} from "@/lib/calendar/client-date";

const PX_PER_MIN = 1.1; // grid vertical scale
const DEFAULT_START_MIN = 8 * 60; // 08:00 fallback when no hours are set
const DEFAULT_END_MIN = 20 * 60; // 20:00 fallback

export interface TimeRangeVM {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export interface WeekMemberVM {
  id: string;
  name: string;
  isOwner: boolean;
}

export interface WeekBookingVM {
  id: string;
  serviceName: string;
  startIso: string;
  endIso: string;
  durationMin: number;
  status: "pending_confirmation" | "confirmed" | "cancelled" | "completed" | "no_show";
  paymentStatus: "unpaid" | "paid";
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  notes: string | null;
  teamMemberId: string | null;
  pendingExpiryAt: string | null;
  guestLocale: string | null;
}

export interface WeekServiceVM {
  id: string;
  name: string;
  durationMin: number;
  price: number;
}

export interface GridDay {
  year: number;
  month: number;
  day: number;
  dayId: DayId;
  dateLabel: string; // short weekday + day, e.g. "lun 15"
  isToday: boolean;
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export function buildGridDays(startUtc: Date, count: number, intlLocale: string): GridDay[] {
  const days: GridDay[] = [];
  const todayKey = tzDateParts(new Date());
  for (let i = 0; i < count; i++) {
    const anchor = new Date(startUtc);
    anchor.setUTCHours(anchor.getUTCHours() + 12); // move to local noon-ish for stable date math
    anchor.setUTCDate(anchor.getUTCDate() + i);
    const { year, month, day } = tzDateParts(anchor);
    const noonUtc = zonedTimeToUtc(year, month, day, 12, 0);
    const label = new Intl.DateTimeFormat(intlLocale, {
      timeZone: TZ, weekday: "short", day: "numeric",
    }).format(noonUtc);
    days.push({
      year, month, day,
      dayId: dayIdInTz(noonUtc),
      dateLabel: label,
      isToday: year === todayKey.year && month === todayKey.month && day === todayKey.day,
    });
  }
  return days;
}

export function CalendarGridView({
  view,
  days,
  members,
  hoursByDay,
  services,
  bookings,
  dict,
  onBookingCreated,
  onBookingClick,
}: {
  view: "day" | "week";
  days: GridDay[];
  members: WeekMemberVM[];
  hoursByDay: Partial<Record<DayId, TimeRangeVM[]>>;
  services: WeekServiceVM[];
  bookings: WeekBookingVM[];
  dict: CalendarDictionary;
  onBookingCreated: () => void;
  onBookingClick: (booking: WeekBookingVM) => void;
}) {
  const router = useRouter();
  const w = dict.week;
  const [modalSlot, setModalSlot] = useState<SlotSelection | null>(null);

  // Grid vertical span: uniform across Day/Week views and day navigation —
  // based on the business's full week of hours (not just the day currently
  // shown), padded by 1h on each side, plus widened further to cover any
  // booking that falls outside that window (e.g. hours were edited after
  // the booking was made). A sane fallback keeps an empty schedule usable.
  const { gridStartMin, gridEndMin } = useMemo(() => {
    let min = DEFAULT_START_MIN;
    let max = DEFAULT_END_MIN;
    let found = false;
    for (const dayId of Object.keys(hoursByDay) as DayId[]) {
      for (const r of hoursByDay[dayId] ?? []) {
        const [sh, sm] = r.start.split(":").map(Number);
        const [eh, em] = r.end.split(":").map(Number);
        const s = sh * 60 + sm, e = eh * 60 + em;
        if (!found) { min = s; max = e; found = true; }
        else { min = Math.min(min, s); max = Math.max(max, e); }
      }
    }
    for (const b of bookings) {
      const parts = tzDateParts(new Date(b.startIso));
      const onDisplayedDay = days.some(
        (d) => d.year === parts.year && d.month === parts.month && d.day === parts.day
      );
      if (!onDisplayedDay) continue;
      const s = minutesInTz(new Date(b.startIso));
      const e = s + b.durationMin;
      if (!found) { min = s; max = e; found = true; }
      else { min = Math.min(min, s); max = Math.max(max, e); }
    }
    const paddedMin = Math.max(0, min - 60);
    const paddedMax = Math.min(24 * 60, max + 60);
    return { gridStartMin: paddedMin, gridEndMin: Math.max(paddedMax, paddedMin + 60) };
  }, [hoursByDay, days, bookings]);

  const gridHeight = (gridEndMin - gridStartMin) * PX_PER_MIN;
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    const firstHour = Math.floor(gridStartMin / 60);
    const lastHour = Math.ceil(gridEndMin / 60);
    for (let h = firstHour; h <= lastHour; h++) marks.push(h * 60);
    return marks;
  }, [gridStartMin, gridEndMin]);

  /**
   * Snaps a raw click-position minute to the nearest real bookable slot —
   * mirrors generateSlotsForDay's default 60-minute step from each working-
   * hours range's start (see lib/booking/slots.ts), so clicking near 10:00
   * lands on 10:00 like the patient wizard would offer, not an arbitrary
   * 15-minute pixel-rounded time. Falls back to a 15-minute mark if the day
   * has no ranges at all (fully closed) — the owner can still book outside
   * hours, just without a slot grid to snap to.
   */
  const snapToSlotGrid = (clickMinute: number, ranges: TimeRangeVM[]): number => {
    const STEP = 60;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const r of ranges) {
      const [sh, sm] = r.start.split(":").map(Number);
      const [eh, em] = r.end.split(":").map(Number);
      const rangeStart = sh * 60 + sm;
      const rangeEnd = eh * 60 + em;
      for (let t = rangeStart; t < rangeEnd; t += STEP) {
        const dist = Math.abs(t - clickMinute);
        if (dist < bestDist) { bestDist = dist; best = t; }
      }
    }
    return best !== null ? best : Math.round(clickMinute / 15) * 15;
  };

  const handleSlotClick = (day: GridDay, member: WeekMemberVM, clickMinute: number, ranges: TimeRangeVM[]) => {
    const rounded = snapToSlotGrid(clickMinute, ranges);
    const hh = Math.floor(rounded / 60);
    const mm = rounded % 60;
    setModalSlot({
      dayYear: day.year,
      dayMonth: day.month,
      dayDay: day.day,
      initialTime: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      teamMemberId: member.id,
      providerName: member.name,
    });
  };

  const handleCreated = () => {
    setModalSlot(null);
    onBookingCreated();
    router.refresh();
  };

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center text-[13.5px] text-ink-soft">
        {w.noProviders}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto overflow-y-visible rounded-2xl border border-line bg-surface">
        <div className={`flex ${view === "week" ? "min-w-[900px]" : "min-w-[420px]"}`}>
          {/* Time gutter */}
          <div className="w-14 shrink-0 border-r border-line">
            <div className="h-12 border-b border-line" />
            <div className="relative" style={{ height: gridHeight }}>
              {hourMarks.map((min) => (
                <div
                  key={min}
                  className="absolute right-2 -translate-y-1/2 text-[11px] text-ink-soft"
                  style={{ top: (min - gridStartMin) * PX_PER_MIN }}
                >
                  {String(Math.floor(min / 60)).padStart(2, "0")}:00
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const ranges = hoursByDay[day.dayId] ?? [];
            return (
              <div key={`${day.year}-${day.month}-${day.day}`} className="flex flex-1 border-r border-line last:border-r-0">
                {members.map((member) => (
                  <DayProviderColumn
                    key={`${day.dayId}-${member.id}`}
                    day={day}
                    member={member}
                    members={members}
                    ranges={ranges}
                    bookings={bookings}
                    gridStartMin={gridStartMin}
                    gridEndMin={gridEndMin}
                    gridHeight={gridHeight}
                    dict={dict}
                    onSlotClick={handleSlotClick}
                    onBookingClick={onBookingClick}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {modalSlot && (
        <AppointmentModal
          slot={modalSlot}
          hoursByDay={hoursByDay}
          allBookings={bookings}
          services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, price: s.price }))}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          dict={dict.modal}
          errorsDict={dict.manualErrors}
          onClose={() => setModalSlot(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

/**
 * Chip color for a booking — time is the primary axis:
 * - Not past (upcoming or happening now): teal-50 bg / teal-900 text /
 *   teal-600 left border — fresh, active, primary appointment.
 * - Past and not yet reviewed (still pending_confirmation/confirmed):
 *   rose-50 bg / rose-900 text / rose-500 left border — a clear but not
 *   "heavy" alert that it needs review.
 * - Past and reviewed (completed/no_show/cancelled via the detail modal):
 *   slate-100 bg / slate-500 text / slate-300 left border — receded,
 *   easy to scan past, done.
 * Always clickable regardless of state — past appointments can be revised.
 */
export function chipClasses(status: WeekBookingVM["status"], isPast: boolean): string {
  if (!isPast) return "bg-teal-50 text-teal-900 border-l-4 border-teal-600";
  const isReviewed = status === "completed" || status === "no_show" || status === "cancelled";
  return isReviewed
    ? "bg-slate-100 text-slate-500 border-l-4 border-slate-300"
    : "bg-rose-50 text-rose-900 border-l-4 border-rose-500";
}

function DayProviderColumn({
  day,
  member,
  members,
  ranges,
  bookings,
  gridStartMin,
  gridEndMin,
  gridHeight,
  dict,
  onSlotClick,
  onBookingClick,
}: {
  day: GridDay;
  member: WeekMemberVM;
  members: WeekMemberVM[];
  ranges: TimeRangeVM[];
  bookings: WeekBookingVM[];
  gridStartMin: number;
  gridEndMin: number;
  gridHeight: number;
  dict: CalendarDictionary;
  onSlotClick: (day: GridDay, member: WeekMemberVM, clickMinute: number, ranges: TimeRangeVM[]) => void;
  onBookingClick: (booking: WeekBookingVM) => void;
}) {
  const dayBookings = bookings.filter((b) => {
    if (b.teamMemberId !== member.id) return false;
    const parts = tzDateParts(new Date(b.startIso));
    return parts.year === day.year && parts.month === day.month && parts.day === day.day;
  });

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickMinute = gridStartMin + offsetY / PX_PER_MIN;
    onSlotClick(day, member, clickMinute, ranges);
  };

  return (
    <div className={`flex-1 ${members.length > 1 ? "border-r border-line/60 last:border-r-0" : ""}`}>
      <div className="flex h-12 flex-col items-center justify-center border-b border-line px-1">
        <span className="text-[12px] font-semibold capitalize text-ink">{day.dateLabel}</span>
        {members.length > 1 && (
          <span className="truncate text-[10.5px] text-ink-soft">{member.name}</span>
        )}
        {day.isToday && <span className="mt-0.5 h-1 w-1 rounded-full bg-brand" />}
      </div>
      <div
        className="relative overflow-hidden cursor-pointer bg-surface-2/50 hover:bg-surface-2/70"
        style={{
          height: gridHeight,
          ...(ranges.length === 0
            ? {
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(15,23,42,0.08) 0px, rgba(15,23,42,0.08) 6px, transparent 6px, transparent 14px)",
              }
            : {}),
        }}
        onClick={handleClick}
        title={dict.week.addAppointment}
      >
        {/* Working-hours = bookable free time: lighter surface on top of the
            muted outside-hours base, so the whole schedule (not just booked
            slots) is visible and free time reads as clearly clickable. Days
            with zero ranges (clinic closed all day) get a diagonal-stripe
            base above instead, so a closed day reads differently from a
            working day's off-hours time. */}
        {ranges.map((r, i) => {
          const [sh, sm] = r.start.split(":").map(Number);
          const [eh, em] = r.end.split(":").map(Number);
          const top = (sh * 60 + sm - gridStartMin) * PX_PER_MIN;
          const height = (eh * 60 + em - (sh * 60 + sm)) * PX_PER_MIN;
          return (
            <div
              key={i}
              className="pointer-events-none absolute left-0 right-0 bg-surface"
              style={{ top, height }}
            />
          );
        })}

        {/* Hour gridlines */}
        {Array.from({ length: Math.floor((gridEndMin - gridStartMin) / 60) + 1 }).map((_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute left-0 right-0 border-t border-line/50"
            style={{ top: i * 60 * PX_PER_MIN }}
          />
        ))}

        {/* Bookings — click opens the detail modal (manage/cancel if
            upcoming, mark result + payment if in the past) instead of
            falling through to the empty-slot "new appointment" handler. */}
        {dayBookings.map((b) => {
          const startMin = minutesInTz(new Date(b.startIso));
          const top = (startMin - gridStartMin) * PX_PER_MIN;
          const height = Math.max(b.durationMin * PX_PER_MIN, 30);
          const isPast = new Date(b.startIso) < new Date();
          return (
            <div
              key={b.id}
              onClick={(e) => { e.stopPropagation(); onBookingClick(b); }}
              className={`absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded-md px-1.5 py-[3px] text-[10.5px] leading-[1.2] ${chipClasses(b.status, isPast)}`}
              style={{ top, height }}
            >
              <div className="truncate">{b.serviceName}</div>
              <div className="truncate opacity-90">{timeLabel(b.startIso)} · {b.clientName}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
