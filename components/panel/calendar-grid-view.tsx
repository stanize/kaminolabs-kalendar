"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { DayId } from "@/lib/onboarding/types";
import { AppointmentModal, type SlotSelection, type ClosureRuleVM } from "@/components/panel/appointment-modal";
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

// Client-relationship status labels/colors (lib/booking/client-status.ts) —
// exported so calendar-bookings.tsx and booking-detail-modal.tsx can reuse
// the exact same labels/colors instead of redefining them, keeping the
// badge visually consistent everywhere it appears (grid chip dot, tab rows,
// detail modal). Kept here (not in the server-only lib/booking/client-
// status.ts) since it needs to be importable from client components without
// pulling in that file's server-only createClient import.
export type ClientStatusValue = "guest_unconfirmed" | "guest_confirmed" | "first_time" | "returning";

// Base/category labels — used for filter-chip text (a category name, not
// tied to any single booking) and as the fallback for clientStatusLabel()
// below. "confirmado" does NOT appear here for guest_confirmed/first_time
// on purpose (2026-09): it used to mean "the booking itself is confirmed",
// which is true for EVERY guest/first-time booking now (they all confirm
// immediately on submit — see public-booking's gotchas), making the old
// static "Invitado · confirmado"/"primera vez" labels misleading — a
// clinic reading them could think a booking still needing their attention
// had already been handled. "confirmado" now means the CLINIC has
// confirmed/contacted them (clinicReviewedAt) instead — see
// clientStatusLabel(), which is what every per-booking badge should call.
export const CLIENT_STATUS_LABEL: Record<ClientStatusValue, string> = {
  guest_unconfirmed: "Invitado · sin confirmar",
  guest_confirmed: "Invitado",
  first_time: "Paciente",
  returning: "Cliente registrado · recurrente",
};

// Base/category dot+badge colors — same "not tied to one booking" caveat
// as CLIENT_STATUS_LABEL above; used for filter-chip dots. Per-booking
// dot/badge rendering should call clientStatusDotClass()/
// clientStatusBadgeClass() below instead, which turn amber while a
// specific booking still needs a clinic action.
export const CLIENT_STATUS_DOT_CLASS: Record<ClientStatusValue, string> = {
  guest_unconfirmed: "bg-amber-500",
  guest_confirmed: "bg-sky-500",
  first_time: "bg-violet-500",
  returning: "bg-emerald-500",
};

export const CLIENT_STATUS_BADGE_CLASS: Record<ClientStatusValue, string> = {
  guest_unconfirmed: "bg-amber-50 text-amber-800 border-amber-200",
  guest_confirmed: "bg-sky-50 text-sky-800 border-sky-200",
  first_time: "bg-violet-50 text-violet-800 border-violet-200",
  returning: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

/**
 * Whether a booking still needs a clinic action/follow-up — the single
 * definition shared by the week/month grid's amber chip color, the dot
 * marker's visibility/color, the per-booking label/badge color below, the
 * booking-detail-modal's follow-up banner, and the Clientes-tab row's
 * action button, so they can never drift apart.
 *
 * - guest_unconfirmed: always true (regardless of clinicReviewedAt — it
 *   has its own separate confirm/cancel action, not the "Contactado /
 *   Confirmado" one).
 * - guest_confirmed OR first_time: true only while clinicReviewedAt is
 *   null. A first-time patient's booking is confirmed immediately just
 *   like a guest's (same account, so no identity risk — but it's still
 *   someone the clinic hasn't met before), so it gets the exact same
 *   standing follow-up flag and "Contactado / Confirmado" treatment a
 *   guest booking does (2026-09).
 * - returning: never — an existing, known client needs no follow-up.
 */
export function needsClinicFollowUp(
  clientStatus: ClientStatusValue,
  clinicReviewedAt: string | null
): boolean {
  if (clientStatus === "guest_unconfirmed") return true;
  if (clientStatus === "guest_confirmed" || clientStatus === "first_time") return !clinicReviewedAt;
  return false;
}

/**
 * Per-BOOKING display label (badges in booking-detail-modal.tsx and the
 * Clientes-tab row, and the grid dot's tooltip) — unlike CLIENT_STATUS_LABEL
 * above, this reflects clinicReviewedAt: "Invitado"/"Paciente" alone while
 * still needing a clinic action, "· confirmado" appended only once the
 * clinic has actually contacted/confirmed them. guest_unconfirmed and
 * returning are unaffected by clinicReviewedAt — always their base label.
 */
export function clientStatusLabel(
  clientStatus: ClientStatusValue,
  clinicReviewedAt: string | null
): string {
  if ((clientStatus === "guest_confirmed" || clientStatus === "first_time") && clinicReviewedAt) {
    return `${CLIENT_STATUS_LABEL[clientStatus]} · confirmado`;
  }
  return CLIENT_STATUS_LABEL[clientStatus];
}

/** Per-booking badge color — amber while needsClinicFollowUp, else the base category color (once reviewed, or for guest_unconfirmed/returning which don't vary). */
export function clientStatusBadgeClass(
  clientStatus: ClientStatusValue,
  clinicReviewedAt: string | null
): string {
  if (needsClinicFollowUp(clientStatus, clinicReviewedAt) && clientStatus !== "guest_unconfirmed") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return CLIENT_STATUS_BADGE_CLASS[clientStatus];
}

/** Per-booking dot color — same amber-while-unreviewed rule as clientStatusBadgeClass above. */
export function clientStatusDotClass(
  clientStatus: ClientStatusValue,
  clinicReviewedAt: string | null
): string {
  if (needsClinicFollowUp(clientStatus, clinicReviewedAt) && clientStatus !== "guest_unconfirmed") {
    return "bg-amber-500";
  }
  return CLIENT_STATUS_DOT_CLASS[clientStatus];
}

export interface WeekBookingVM {
  id: string;
  serviceId: string | null;
  serviceName: string;
  startIso: string;
  endIso: string;
  durationMin: number;
  status: "pending_confirmation" | "confirmed" | "cancelled" | "completed" | "no_show";
  paymentStatus: "unpaid" | "paid";
  paymentMethod: "cash" | "card" | "bono" | null;
  bonoPurchaseId: string | null;
  clinicClientId: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  notes: string | null;
  teamMemberId: string | null;
  pendingExpiryAt: string | null;
  guestLocale: string | null;
  reminderSendFailed: boolean;
  lastReminderError: string | null;
  // Set when a patient tried to self-cancel inside the clinic's
  // cancellation window and is now awaiting owner approve/deny (see
  // schema comment on kalendar_bookings.cancellation_requested_at).
  cancellationRequestedAt: string | null;
  // See lib/booking/client-status.ts — how much the clinic should
  // double-check this reservation, independent of `status` above.
  clientStatus: ClientStatusValue;
  // NULL = clinic hasn't marked this guest booking as contacted/reviewed
  // yet (kalendar_bookings.clinic_reviewed_at). Only meaningful when
  // clientStatus === "guest_confirmed" — gates the week-grid dot marker
  // below, cleared only by an explicit clinic action, never derived from
  // clientStatus alone (that stays "guest_confirmed" for the booking's
  // whole lifetime).
  clinicReviewedAt: string | null;
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
  isPast: boolean; // strictly before today — a booking can still be made here (e.g. a walk-in), just visually receded
  // holidays-and-time-off (2026-09-26): true when this date matches a
  // recurring, clinic-wide festivo (never a one-off provider vacation/time
  // off — that's visible via the Conflictos tab instead, not this visual).
  isFestivo: boolean;
  // The matched festivo's own label, or null when it has none (caller shows
  // a generic fallback, e.g. "Festivo"). Only meaningful when isFestivo.
  festivoLabel: string | null;
}

/** A recurring, clinic-wide festivo as buildGridDays needs it — month/day
 *  only (matches BusinessClosure's recurring shape), label optional. */
export interface GridDayFestivo {
  month: number;
  day: number;
  label: string | null;
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export function buildGridDays(
  startUtc: Date,
  count: number,
  intlLocale: string,
  festivos: GridDayFestivo[] = []
): GridDay[] {
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
    const festivo = festivos.find((f) => f.month === month && f.day === day);
    days.push({
      year, month, day,
      dayId: dayIdInTz(noonUtc),
      dateLabel: label,
      isToday: year === todayKey.year && month === todayKey.month && day === todayKey.day,
      isPast:
        year < todayKey.year ||
        (year === todayKey.year && month < todayKey.month) ||
        (year === todayKey.year && month === todayKey.month && day < todayKey.day),
      isFestivo: !!festivo,
      festivoLabel: festivo?.label ?? null,
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
  closures,
  dict,
  whatsappEnabled,
  onBookingCreated,
  onBookingClick,
}: {
  view: "day" | "week";
  days: GridDay[];
  members: WeekMemberVM[];
  hoursByDay: Partial<Record<DayId, TimeRangeVM[]>>;
  services: WeekServiceVM[];
  bookings: WeekBookingVM[];
  closures: ClosureRuleVM[];
  dict: CalendarDictionary;
  whatsappEnabled: boolean;
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
          mode="create"
          slot={modalSlot}
          hoursByDay={hoursByDay}
          allBookings={bookings}
          services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, price: s.price }))}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          closures={closures}
          dict={dict.modal}
          errorsDict={dict.manualErrors}
          whatsappEnabled={whatsappEnabled}
          onClose={() => setModalSlot(null)}
          onSaved={handleCreated}
        />
      )}
    </div>
  );
}

/**
 * Chip color for a booking:
 * - Not past AND needs a clinic action (see needsClinicFollowUp) — amber-50
 *   bg / amber-900 text / amber-500 left border, so it stands out across
 *   the whole chip, not just via the small dot.
 * - Not past and no clinic action needed (a returning client, or a
 *   guest/first-time booking already marked reviewed): teal-50 bg /
 *   teal-900 text / teal-600 left border — fresh, active, primary
 *   appointment.
 * - Past and not yet reviewed (still pending_confirmation/confirmed):
 *   rose-50 bg / rose-900 text / rose-500 left border — a clear but not
 *   "heavy" alert that it needs review.
 * - Past and reviewed (completed/no_show/cancelled via the detail modal):
 *   slate-100 bg / slate-500 text / slate-300 left border — receded,
 *   easy to scan past, done.
 * Always clickable regardless of state — past appointments can be revised.
 */
export function chipClasses(
  status: WeekBookingVM["status"],
  isPast: boolean,
  clientStatus: ClientStatusValue,
  clinicReviewedAt: string | null
): string {
  if (!isPast) {
    return needsClinicFollowUp(clientStatus, clinicReviewedAt)
      ? "bg-amber-50 text-amber-900 border-l-4 border-amber-500"
      : "bg-teal-50 text-teal-900 border-l-4 border-teal-600";
  }
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
        <span className={`text-[12px] font-semibold capitalize ${day.isPast ? "text-ink-soft" : "text-ink"}`}>
          {day.dateLabel}
        </span>
        {day.isFestivo && (
          <span className="truncate text-[10px] font-medium text-amber-700">
            ({day.festivoLabel || dict.week.festivoFallbackLabel})
          </span>
        )}
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

        {/* Past-day wash: a uniform, subtle grey layer over the ENTIRE
            column (both working-hours and outside-hours areas alike), so a
            past day reads as visually receded at a glance without changing
            its underlying working-hours/closed-day treatment above.
            pointer-events-none + no onClick of its own — a past day is
            still fully clickable to add a booking (e.g. a walk-in). Sits
            below the gridlines/booking chips so those stay unaffected. */}
        {day.isPast && <div className="pointer-events-none absolute inset-0 bg-ink/5" />}

        {/* Festivo wash — same layering technique as the past-day wash above
            (uniform, non-interactive overlay across the whole column, so
            clicking to add a walk-in booking still works), reusing the same
            amber tone chipClasses already uses for a "needs clinic
            follow-up" booking, so the two amber cues read consistently. */}
        {day.isFestivo && <div className="pointer-events-none absolute inset-0 bg-amber-50/60" />}

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
              className={`absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded-md px-1.5 py-[3px] text-[10.5px] leading-[1.2] ${chipClasses(b.status, isPast, b.clientStatus, b.clinicReviewedAt)}`}
              style={{ top, height }}
            >
              <div className="truncate">
                {b.cancellationRequestedAt && (
                  <span title="Solicitud de cancelación pendiente" className="mr-1 text-rose-600">🛑</span>
                )}
                {b.reminderSendFailed && (
                  <span title="Recordatorio no enviado" className="mr-1 text-amber-600">⚠</span>
                )}
                {/* Dot mirrors needsClinicFollowUp for guest_confirmed/
                    first_time (clears once clinicReviewedAt is set) —
                    other statuses' dots are a standing scrutiny-level
                    indicator and always show. Color and tooltip both come
                    from the same per-booking functions the badge/chip use,
                    so this never drifts from them. */}
                {(b.clientStatus !== "guest_confirmed" && b.clientStatus !== "first_time") || !b.clinicReviewedAt ? (
                  <span
                    title={clientStatusLabel(b.clientStatus, b.clinicReviewedAt)}
                    className={`mr-1 inline-block h-[7px] w-[7px] rounded-full align-middle ${clientStatusDotClass(b.clientStatus, b.clinicReviewedAt)}`}
                  />
                ) : null}
                {b.serviceName}
              </div>
              <div className="truncate opacity-90">{timeLabel(b.startIso)} · {b.clientName}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
