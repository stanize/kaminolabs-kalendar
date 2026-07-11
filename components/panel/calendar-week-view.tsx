"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { fetchWeekBookings } from "@/lib/actions/booking-owner";
import { AppointmentModal, type SlotSelection } from "@/components/panel/appointment-modal";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { DayId } from "@/lib/onboarding/types";

const TZ = "Europe/Madrid";
const DAY_ORDER: DayId[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
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
  status: "pending_confirmation" | "confirmed" | "cancelled" | "completed";
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
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

// ── Madrid-tz date helpers (duplicated from lib/booking/slots.ts on purpose:
// that file is server-only and can't be imported into a client component) ──

function tzDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function dayIdInTz(date: Date): DayId {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
  const map: Record<string, DayId> = {
    Sun: "sun", Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat",
  };
  return map[wd] ?? "mon";
}

function zonedTimeToUtc(year: number, month: number, day: number, hh: number, mm: number): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hh, mm, 0);
  const asUtc = new Date(utcGuess);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(asUtc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shownUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = shownUtc - utcGuess;
  return new Date(utcGuess - offset);
}

function minutesInTz(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** UTC instant for the Monday 00:00 (Madrid) of the week containing `date`. */
function mondayStart(date: Date): Date {
  const dId = dayIdInTz(date);
  const idx = DAY_ORDER.indexOf(dId);
  const { year, month, day } = tzDateParts(date);
  // Anchor at UTC noon of the calendar day — stable across DST, safe to shift by whole days.
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() - idx);
  const mp = tzDateParts(anchor);
  return zonedTimeToUtc(mp.year, mp.month, mp.day, 0, 0);
}

interface WeekDay {
  year: number;
  month: number;
  day: number;
  dayId: DayId;
  dateLabel: string; // short weekday + day, e.g. "lun 15"
  isToday: boolean;
}

function buildWeekDays(mondayUtc: Date, intlLocale: string): WeekDay[] {
  const days: WeekDay[] = [];
  const todayKey = tzDateParts(new Date());
  for (let i = 0; i < 7; i++) {
    const anchor = new Date(mondayUtc);
    anchor.setUTCHours(anchor.getUTCHours() + 12); // move to local noon-ish for stable date math
    anchor.setUTCDate(anchor.getUTCDate() + i);
    const { year, month, day } = tzDateParts(anchor);
    const dayId = DAY_ORDER[i];
    const label = new Intl.DateTimeFormat(intlLocale, {
      timeZone: TZ, weekday: "short", day: "numeric",
    }).format(zonedTimeToUtc(year, month, day, 12, 0));
    days.push({
      year, month, day, dayId,
      dateLabel: label,
      isToday: year === todayKey.year && month === todayKey.month && day === todayKey.day,
    });
  }
  return days;
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export function CalendarWeekView({
  members,
  hoursByDay,
  services,
  initialBookings,
  initialWeekStartIso,
  dict,
}: {
  members: WeekMemberVM[];
  hoursByDay: Partial<Record<DayId, TimeRangeVM[]>>;
  services: WeekServiceVM[];
  initialBookings: WeekBookingVM[];
  initialWeekStartIso: string;
  dict: CalendarDictionary;
}) {
  const router = useRouter();
  const w = dict.week;
  const [weekStartIso, setWeekStartIso] = useState(initialWeekStartIso);
  const [bookings, setBookings] = useState(initialBookings);
  const [loading, setLoading] = useState(false);
  const [modalSlot, setModalSlot] = useState<SlotSelection | null>(null);

  const weekStartDate = useMemo(() => new Date(weekStartIso), [weekStartIso]);
  const weekDays = useMemo(
    () => buildWeekDays(weekStartDate, dict.intlLocale),
    [weekStartDate, dict.intlLocale]
  );

  // Grid vertical span: widest working-hours window across the week, with a
  // sane fallback so an empty schedule still renders a usable grid.
  const { gridStartMin, gridEndMin } = useMemo(() => {
    let min = DEFAULT_START_MIN;
    let max = DEFAULT_END_MIN;
    let found = false;
    for (const ranges of Object.values(hoursByDay)) {
      for (const r of ranges ?? []) {
        const [sh, sm] = r.start.split(":").map(Number);
        const [eh, em] = r.end.split(":").map(Number);
        const s = sh * 60 + sm, e = eh * 60 + em;
        if (!found) { min = s; max = e; found = true; }
        else { min = Math.min(min, s); max = Math.max(max, e); }
      }
    }
    return { gridStartMin: min, gridEndMin: Math.max(max, min + 60) };
  }, [hoursByDay]);

  const gridHeight = (gridEndMin - gridStartMin) * PX_PER_MIN;
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    const firstHour = Math.floor(gridStartMin / 60);
    const lastHour = Math.ceil(gridEndMin / 60);
    for (let h = firstHour; h <= lastHour; h++) marks.push(h * 60);
    return marks;
  }, [gridStartMin, gridEndMin]);

  const goToWeek = useCallback(async (newMondayUtc: Date) => {
    setLoading(true);
    const newStartIso = newMondayUtc.toISOString();
    const newEnd = new Date(newMondayUtc);
    newEnd.setUTCDate(newEnd.getUTCDate() + 7);
    try {
      const fresh = await fetchWeekBookings(newStartIso, newEnd.toISOString());
      setWeekStartIso(newStartIso);
      setBookings(fresh);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePrevWeek = () => {
    const prev = new Date(weekStartDate);
    prev.setUTCDate(prev.getUTCDate() - 7);
    goToWeek(prev);
  };
  const handleNextWeek = () => {
    const next = new Date(weekStartDate);
    next.setUTCDate(next.getUTCDate() + 7);
    goToWeek(next);
  };
  const handleToday = () => goToWeek(mondayStart(new Date()));

  const handleSlotClick = (day: WeekDay, member: WeekMemberVM, clickMinute: number) => {
    const rounded = Math.round(clickMinute / 15) * 15;
    const hh = Math.floor(rounded / 60);
    const mm = rounded % 60;
    const startDate = zonedTimeToUtc(day.year, day.month, day.day, hh, mm);
    const dateTimeLabel = new Intl.DateTimeFormat(dict.intlLocale, {
      timeZone: TZ, weekday: "long", day: "numeric", month: "long",
    }).format(startDate) + ` · ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    setModalSlot({
      startIso: startDate.toISOString(),
      dateTimeLabel,
      teamMemberId: member.id,
      providerName: member.name,
    });
  };

  const handleCreated = () => {
    setModalSlot(null);
    goToWeek(weekStartDate);
    router.refresh();
  };

  const rangeLabel = w.weekRangeTemplate
    .replace("{from}", weekDays[0]?.dateLabel ?? "")
    .replace("{to}", weekDays[6]?.dateLabel ?? "");

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center text-[13.5px] text-ink-soft">
        {w.noProviders}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevWeek}
            aria-label={w.prevWeek}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <button
            onClick={handleNextWeek}
            aria-label={w.nextWeek}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="chevronRight" size={16} />
          </button>
          <button
            onClick={handleToday}
            className="ml-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            {w.today}
          </button>
          <span className="ml-2 text-[13.5px] font-semibold capitalize text-ink">{rangeLabel}</span>
        </div>
        {loading && <span className="text-[12px] text-ink-soft">…</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <div className="flex min-w-[900px]">
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
          {weekDays.map((day) => {
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
}: {
  day: WeekDay;
  member: WeekMemberVM;
  members: WeekMemberVM[];
  ranges: TimeRangeVM[];
  bookings: WeekBookingVM[];
  gridStartMin: number;
  gridEndMin: number;
  gridHeight: number;
  dict: CalendarDictionary;
  onSlotClick: (day: WeekDay, member: WeekMemberVM, clickMinute: number) => void;
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
    onSlotClick(day, member, clickMinute);
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
        className="relative cursor-pointer bg-surface hover:bg-surface-2/40"
        style={{ height: gridHeight }}
        onClick={handleClick}
        title={dict.week.addAppointment}
      >
        {/* Working-hours shading */}
        {ranges.map((r, i) => {
          const [sh, sm] = r.start.split(":").map(Number);
          const [eh, em] = r.end.split(":").map(Number);
          const top = (sh * 60 + sm - gridStartMin) * PX_PER_MIN;
          const height = (eh * 60 + em - (sh * 60 + sm)) * PX_PER_MIN;
          return (
            <div
              key={i}
              className="pointer-events-none absolute left-0 right-0 bg-brand-weak/25"
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

        {/* Bookings */}
        {dayBookings.map((b) => {
          const startMin = minutesInTz(new Date(b.startIso));
          const top = (startMin - gridStartMin) * PX_PER_MIN;
          const height = Math.max(b.durationMin * PX_PER_MIN, 18);
          const isPending = b.status === "pending_confirmation";
          return (
            <div
              key={b.id}
              onClick={(e) => e.stopPropagation()}
              className={`absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-[10.5px] leading-tight ${
                isPending ? "bg-orange-100 text-orange-700" : "bg-brand text-white"
              }`}
              style={{ top, height }}
            >
              <div className="truncate font-semibold">{timeLabel(b.startIso)} · {b.clientName}</div>
              <div className="truncate opacity-90">{b.serviceName}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
