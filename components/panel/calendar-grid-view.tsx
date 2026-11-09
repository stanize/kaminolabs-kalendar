"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { DayId } from "@/lib/onboarding/types";
import { AppointmentModal, type SlotSelection, type ClosureRuleVM } from "@/components/panel/appointment-modal";
import type { CustomTimeSlotRuleVM } from "@/lib/booking/appointment-fields";
import { ClosureConflictDialog } from "@/components/panel/closure-conflict-dialog";
import type { ConflictSummary } from "@/lib/actions/closures";
import { updateBookingAsOwner } from "@/lib/actions/booking-owner";
import {
  TZ,
  tzDateParts,
  dayIdInTz,
  zonedTimeToUtc,
  minutesInTz,
} from "@/lib/calendar/client-date";

/** Where a dragged chip currently hovers — used both to render the drop
 *  preview and, on release, to compute the new startIso. */
export interface DragTarget {
  year: number;
  month: number;
  day: number;
  startMin: number;
}

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
  // team-member-lifecycle: false once a member with bookings is
  // deleted-as-disabled — the week column and this member's existing
  // bookings still show, but they're excluded from new-booking pickers.
  active: boolean;
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
  paymentMethod: "cash" | "card" | "bono" | "bank_transfer" | "bizum" | "direct_debit" | "paypal" | "other" | null;
  bonoPurchaseId: string | null;
  paidAt: string | null;
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseHM(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export interface MemberTimeOff {
  fullDay: boolean;
  startMin: number | null; // null when fullDay
  endMin: number | null; // null when fullDay
  label: string | null;
}

/** One-off (non-recurring) time off affecting this provider on this date —
 *  clinic-wide (teamMemberId null) or scoped to this member. holidays-and-
 *  time-off: unlike a recurring festivo (clinic-wide, grid-level), this is
 *  per-provider and per-date-range, so it's computed per (day, member) at
 *  render time from the full closures list rather than pre-reduced in
 *  buildGridDays. */
function memberTimeOffForDay(
  closures: ClosureRuleVM[],
  year: number, month: number, day: number,
  memberId: string
): MemberTimeOff[] {
  const dateStr = isoDateKey(year, month, day);
  return closures
    .filter((c) => !c.recurring && (c.teamMemberId === null || c.teamMemberId === memberId))
    .filter((c) => c.startDate && c.endDate && c.startDate <= dateStr && dateStr <= c.endDate)
    .map((c) => ({
      fullDay: !c.startTime || !c.endTime,
      startMin: c.startTime ? parseHM(c.startTime) : null,
      endMin: c.endTime ? parseHM(c.endTime) : null,
      label: c.label,
    }));
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

// multi-provider-calendar-display (workflows/calendar-management-upcoming.md):
// the merged Week view's per-booking provider badge color — indexed by the
// provider's position in the FULL team roster (allMembers), not the
// filtered/visible list, so a given provider's color never shifts just
// because the filter selection changed.
const PROVIDER_COLOR_PALETTE = [
  "bg-blue-600", "bg-purple-600", "bg-pink-600", "bg-orange-600",
  "bg-cyan-600", "bg-lime-600", "bg-indigo-600", "bg-fuchsia-600",
];

function providerColorClass(memberId: string, allMembers: WeekMemberVM[]): string {
  const idx = allMembers.findIndex((m) => m.id === memberId);
  return PROVIDER_COLOR_PALETTE[(idx < 0 ? 0 : idx) % PROVIDER_COLOR_PALETTE.length];
}

export interface DayBookingCluster {
  bookings: WeekBookingVM[];
  startMs: number;
  endMs: number;
}

/**
 * multi-provider-calendar-display: groups a day's bookings into maximal
 * clusters of chained time overlaps — the merged Week view renders each
 * cluster as one box (a single booking rendered as today's normal
 * multi-line chip; 2+ overlapping bookings from different providers
 * rendered as compact single-line rows stacked inside one shared box,
 * per Arun's call — NOT side by side, which made everything too narrow
 * to read at a glance).
 */
function clusterDayBookings(dayBookings: WeekBookingVM[]): DayBookingCluster[] {
  const sorted = [...dayBookings]
    .map((b) => {
      const start = new Date(b.startIso).getTime();
      return { booking: b, start, end: start + b.durationMin * 60_000 };
    })
    .sort((a, b) => a.start - b.start);

  const clusters: DayBookingCluster[] = [];
  let i = 0;
  while (i < sorted.length) {
    let clusterEnd = sorted[i].end;
    let j = i + 1;
    while (j < sorted.length && sorted[j].start < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, sorted[j].end);
      j++;
    }
    const items = sorted.slice(i, j);
    clusters.push({ bookings: items.map((it) => it.booking), startMs: items[0].start, endMs: clusterEnd });
    i = j;
  }
  return clusters;
}

export function CalendarGridView({
  view,
  days,
  members,
  allMembers,
  hoursByDay,
  services,
  bookings,
  closures,
  customSlotRules,
  dict,
  whatsappEnabled,
  onBookingCreated,
  onBookingClick,
}: {
  view: "day" | "week";
  days: GridDay[];
  // multi-provider-calendar-display: the VISIBLE/filtered provider set —
  // bounds which column(s) render. Falls back to `allMembers` wherever the
  // caller passes the same array for both (no filter active).
  members: WeekMemberVM[];
  // The full team roster, regardless of the active filter — used for the
  // "Nueva cita" modal's provider dropdown (a clinic can still book for
  // someone not currently shown) and for stable per-provider color
  // assignment in the merged Week view.
  allMembers: WeekMemberVM[];
  hoursByDay: Partial<Record<DayId, TimeRangeVM[]>>;
  services: WeekServiceVM[];
  bookings: WeekBookingVM[];
  closures: ClosureRuleVM[];
  customSlotRules: CustomTimeSlotRuleVM[];
  dict: CalendarDictionary;
  whatsappEnabled: boolean;
  onBookingCreated: () => void;
  onBookingClick: (booking: WeekBookingVM) => void;
}) {
  const router = useRouter();
  const w = dict.week;
  const [modalSlot, setModalSlot] = useState<SlotSelection | null>(null);

  // drag-to-reschedule (workflows/calendar-management-upcoming.md): custom
  // pointer-events drag, no library. `drag` drives the single snapped
  // drop-preview (dashed box) in whichever day column the pointer is over
  // — Arun feedback (2026-11-09): an earlier version also rendered a
  // second, unsnapped floating clone following the raw cursor, which read
  // as two competing/fighting boxes rather than one clear indicator; that
  // clone is gone, the dashed snapped box is the only drag visual now.
  // Dropping no longer saves immediately either — it opens `moveConfirm`
  // (a "move this appointment?" dialog with a send-email checkbox,
  // default checked) and nothing is written until the clinic confirms;
  // `drag` stays frozen at the dropped target while that dialog is open so
  // the dashed box keeps showing where it will land. The booking's own
  // teamMemberId never changes regardless of view (single-provider or
  // merged) — only starts_at moves. `suppressNextClickRef` swallows the
  // click that a pointerup after an actual drag would otherwise fire (a
  // plain tap with no movement still opens the detail modal as before).
  const [drag, setDrag] = useState<{ booking: WeekBookingVM; target: DragTarget | null } | null>(null);
  const [moveConfirm, setMoveConfirm] = useState<{ booking: WeekBookingVM; target: DragTarget; sendEmail: boolean } | null>(null);
  // Optimistic override: once the clinic confirms the move (no conflict,
  // or conflict then confirmed), show the booking at its NEW time
  // immediately rather than waiting for the server round-trip + the
  // parent's refetch to land — that gap was the "takes a while to appear
  // in the new slot, stays in the old one" complaint. Cleared once the
  // `bookings` prop itself changes (the refetch triggered by
  // onBookingCreated() landed and now reflects the real new time), or
  // immediately on a failed move (revert to the old position).
  const [pendingMove, setPendingMove] = useState<{ bookingId: string; startIso: string } | null>(null);
  const [conflictPrompt, setConflictPrompt] = useState<{ booking: WeekBookingVM; target: DragTarget; sendEmail: boolean; conflicts: ConflictSummary } | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const suppressNextClickRef = useRef(false);
  const firstBookingsEffectRef = useRef(true);

  const displayBookings = useMemo(() => {
    if (!pendingMove) return bookings;
    return bookings.map((b) => (b.id === pendingMove.bookingId ? { ...b, startIso: pendingMove.startIso } : b));
  }, [bookings, pendingMove]);

  // Only clears the optimistic override once the underlying `bookings` prop
  // itself changes (the real refetch landed) — not on every render, and not
  // on the initial mount (nothing pending then anyway).
  useEffect(() => {
    if (firstBookingsEffectRef.current) { firstBookingsEffectRef.current = false; return; }
    setPendingMove(null);
  }, [bookings]);

  async function finalizeMove(booking: WeekBookingVM, target: DragTarget, sendEmail: boolean, confirmed?: boolean) {
    if (!booking.teamMemberId || !booking.serviceId) return;
    const hh = Math.floor(target.startMin / 60);
    const mm = target.startMin % 60;
    const startIso = zonedTimeToUtc(target.year, target.month, target.day, hh, mm).toISOString();
    setPendingMove({ bookingId: booking.id, startIso }); // show the move instantly, before the server even responds
    setMoving(true);
    setMoveError(null);
    try {
      const res = await updateBookingAsOwner(
        {
          bookingId: booking.id,
          serviceId: booking.serviceId,
          teamMemberId: booking.teamMemberId,
          startIso,
          clientName: booking.clientName,
          clientEmail: booking.clientEmail || undefined,
          clientPhone: booking.clientPhone || undefined,
          notes: booking.notes || undefined,
          sendConfirmationEmail: sendEmail,
          sendConfirmationWhatsapp: false,
          confirmed,
        },
        dict.manualErrors
      );
      if (!res.ok) { setMoveError(res.error); setPendingMove(null); setMoveConfirm(null); setConflictPrompt(null); setDrag(null); return; }
      if ("needsConfirmation" in res) { setConflictPrompt({ booking, target, sendEmail, conflicts: res.conflicts }); setPendingMove(null); setMoveConfirm(null); return; }
      setConflictPrompt(null);
      setMoveConfirm(null);
      setDrag(null);
      onBookingCreated();
      router.refresh();
    } finally {
      setMoving(false);
    }
  }

  function startChipDrag(booking: WeekBookingVM, e: React.PointerEvent<HTMLDivElement>) {
    if (booking.status === "cancelled" || booking.status === "no_show") return;
    if (!booking.teamMemberId || !booking.serviceId) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    // How far (in minutes) below the chip's own top edge the pointer grabbed
    // it — without this, the drop-preview's top edge snaps to wherever the
    // cursor currently is, regardless of where inside the chip the drag
    // started, which reads as "pulling" the box around rather than
    // genuinely dragging it (Arun feedback, 2026-11-09).
    const chipRect = e.currentTarget.getBoundingClientRect();
    const grabOffsetMin = (e.clientY - chipRect.top) / PX_PER_MIN;
    let dragging = false;
    let target: DragTarget | null = null;

    function onMove(ev: PointerEvent) {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        dragging = true;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const col = el?.closest<HTMLElement>("[data-grid-day]");
      if (!col?.dataset.gridDay) return;
      const [y, m, d] = col.dataset.gridDay.split("-").map(Number);
      const rect = col.getBoundingClientRect();
      const offsetY = ev.clientY - rect.top;
      let minute = gridStartMin + offsetY / PX_PER_MIN - grabOffsetMin;
      minute = Math.round(minute / 15) * 15;
      minute = Math.max(gridStartMin, Math.min(gridEndMin - booking.durationMin, minute));
      target = { year: y, month: m, day: d, startMin: minute };
      setDrag({ booking, target });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (dragging && target) {
        suppressNextClickRef.current = true;
        // Dropped back on the exact same day+time it started at — nothing
        // actually changed, so just cancel silently instead of opening the
        // confirm dialog (Arun feedback, 2026-11-09).
        const originalParts = tzDateParts(new Date(booking.startIso));
        const originalMin = minutesInTz(new Date(booking.startIso));
        const isNoOp =
          target.year === originalParts.year && target.month === originalParts.month && target.day === originalParts.day && target.startMin === originalMin;
        if (isNoOp) {
          setDrag(null);
          return;
        }
        // Freeze `drag` at the dropped target (don't clear it) so the
        // dashed preview keeps showing where it'll land while the confirm
        // dialog is open.
        setMoveConfirm({ booking, target, sendEmail: true });
      } else {
        setDrag(null);
      }
    }
    function onCancel() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      setDrag(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  function handleChipClick(booking: WeekBookingVM) {
    if (suppressNextClickRef.current) { suppressNextClickRef.current = false; return; }
    onBookingClick(booking);
  }

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

  // multi-provider-calendar-display: `member` is null when the click came
  // from the merged Week view's single day column — there's no per-click
  // provider to default to there, so the modal opens with the provider
  // field blank/required instead of silently picking one.
  const handleSlotClick = (day: GridDay, member: WeekMemberVM | null, clickMinute: number, ranges: TimeRangeVM[]) => {
    // A drag-release fires a synthetic click on the nearest common ancestor
    // of where the gesture started (the chip) and ended (the day column's
    // own background, since the chip never visually moves) — that ancestor
    // is this very slot-click handler's owner, so a completed drag must
    // swallow it too, not just the chip's own click (handleChipClick).
    if (suppressNextClickRef.current) { suppressNextClickRef.current = false; return; }
    const rounded = snapToSlotGrid(clickMinute, ranges);
    const hh = Math.floor(rounded / 60);
    const mm = rounded % 60;
    setModalSlot({
      dayYear: day.year,
      dayMonth: day.month,
      dayDay: day.day,
      initialTime: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      teamMemberId: member?.id ?? "",
      providerName: member?.name ?? "",
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

  // multi-provider-calendar-display: Week view merges into one provider-
  // coded column per day once more than one provider is active — avoids
  // the 7-days × N-providers column explosion. Day view (and a Week view
  // narrowed to exactly one provider) keeps the original per-provider
  // sub-column rendering, where there's always a real column to default
  // a new appointment's provider to.
  const merged = view === "week" && members.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {merged && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
          {members.map((member) => (
            <span key={member.id} className="flex items-center gap-1.5 text-[12px] text-ink-soft">
              <span className={`h-2.5 w-2.5 rounded-full ${providerColorClass(member.id, allMembers)}`} />
              {member.name}
            </span>
          ))}
        </div>
      )}

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
            if (merged) {
              return (
                <div
                  key={`${day.year}-${day.month}-${day.day}`}
                  data-grid-day={`${day.year}-${day.month}-${day.day}`}
                  className="flex flex-1 border-r border-line last:border-r-0"
                >
                  <DayMergedColumn
                    day={day}
                    members={members}
                    allMembers={allMembers}
                    ranges={ranges}
                    bookings={displayBookings}
                    gridStartMin={gridStartMin}
                    gridEndMin={gridEndMin}
                    gridHeight={gridHeight}
                    dict={dict}
                    drag={drag}
                    onSlotClick={(d, clickMinute, r) => handleSlotClick(d, null, clickMinute, r)}
                    onBookingClick={handleChipClick}
                    onAddAtBooking={(d, booking, r) => handleSlotClick(d, null, minutesInTz(new Date(booking.startIso)), r)}
                    onChipPointerDown={startChipDrag}
                  />
                </div>
              );
            }
            return (
              <div
                key={`${day.year}-${day.month}-${day.day}`}
                data-grid-day={`${day.year}-${day.month}-${day.day}`}
                className="flex flex-1 border-r border-line last:border-r-0"
              >
                {members.map((member) => (
                  <DayProviderColumn
                    key={`${day.dayId}-${member.id}`}
                    day={day}
                    member={member}
                    members={members}
                    ranges={ranges}
                    bookings={displayBookings}
                    closures={closures}
                    gridStartMin={gridStartMin}
                    gridEndMin={gridEndMin}
                    gridHeight={gridHeight}
                    dict={dict}
                    drag={drag}
                    onSlotClick={handleSlotClick}
                    onBookingClick={handleChipClick}
                    onChipPointerDown={startChipDrag}
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
          /* team-member-lifecycle: a new appointment can only be assigned
             to an active provider — a disabled member (has bookings, can't
             be hard-deleted) stays visible on existing bookings/columns but
             drops out of this picker. */
          members={allMembers.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }))}
          closures={closures}
          customSlotRules={customSlotRules}
          dict={dict}
          errorsDict={dict.manualErrors}
          whatsappEnabled={whatsappEnabled}
          onClose={() => setModalSlot(null)}
          onSaved={handleCreated}
        />
      )}

      {moveConfirm && (
        <MoveConfirmDialog
          booking={moveConfirm.booking}
          target={moveConfirm.target}
          sendEmail={moveConfirm.sendEmail}
          intlLocale={dict.intlLocale}
          dict={dict.dragConfirm}
          saving={moving}
          onToggleSendEmail={(v) => setMoveConfirm((m) => (m ? { ...m, sendEmail: v } : m))}
          onCancel={() => { setMoveConfirm(null); setDrag(null); }}
          onConfirm={() => finalizeMove(moveConfirm.booking, moveConfirm.target, moveConfirm.sendEmail)}
        />
      )}

      {conflictPrompt && (
        <ClosureConflictDialog
          conflicts={conflictPrompt.conflicts}
          intlLocale={dict.intlLocale}
          dict={dict.bookingConflict}
          saving={moving}
          onCancel={() => { setConflictPrompt(null); setPendingMove(null); setMoveConfirm(null); setDrag(null); }}
          onConfirm={() => finalizeMove(conflictPrompt.booking, conflictPrompt.target, conflictPrompt.sendEmail, true)}
        />
      )}

      {moveError && (
        <div
          onClick={() => setMoveError(null)}
          className="fixed bottom-4 right-4 z-50 max-w-sm cursor-pointer rounded-lg border border-error bg-error-weak px-4 py-2.5 text-[13px] text-error shadow-lg"
        >
          {moveError}
        </div>
      )}
    </div>
  );
}

function MoveConfirmDialog({
  booking,
  target,
  sendEmail,
  intlLocale,
  dict,
  saving,
  onToggleSendEmail,
  onCancel,
  onConfirm,
}: {
  booking: WeekBookingVM;
  target: DragTarget;
  sendEmail: boolean;
  intlLocale: string;
  dict: CalendarDictionary["dragConfirm"];
  saving: boolean;
  onToggleSendEmail: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const fromDate = new Date(booking.startIso);
  const toDate = zonedTimeToUtc(target.year, target.month, target.day, Math.floor(target.startMin / 60), target.startMin % 60);
  const timeFmt = new Intl.DateTimeFormat(intlLocale, { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const dateFmt = new Intl.DateTimeFormat(intlLocale, { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onClick={onCancel}>
      <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[16px] font-semibold text-ink">{dict.title}</h2>
        <p className="mt-1.5 text-[13.5px] font-medium text-ink">{booking.clientName}</p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-center">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">{dict.beforeLabel}</p>
            <p className="mt-0.5 text-[18px] font-bold text-ink-soft line-through decoration-ink-soft/50">{timeFmt.format(fromDate)}</p>
            <p className="text-[11.5px] text-ink-soft">{dateFmt.format(fromDate)}</p>
          </div>
          <div className="rounded-xl border-2 border-brand bg-brand-weak px-3 py-2.5 text-center">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand">{dict.afterLabel}</p>
            <p className="mt-0.5 text-[18px] font-bold text-brand-ink">{timeFmt.format(toDate)}</p>
            <p className="text-[11.5px] text-brand-ink/80">{dateFmt.format(toDate)}</p>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={sendEmail} onChange={(e) => onToggleSendEmail(e.target.checked)} className="h-4 w-4 rounded border-line accent-brand" />
          {dict.sendEmailLabel}
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={saving} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-50">
            {dict.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? dict.confirming : dict.confirm}
          </button>
        </div>
      </div>
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
  // payment-cancellation-flow-expansion: a cancelled or no-show booking
  // always renders grey + strikethrough, regardless of past/future and
  // regardless of the usual follow-up-urgency color scheme below — same
  // treatment for both, no visual distinction between "cancelled ahead of
  // time" and "no-show after the fact". Still fully clickable (no
  // pointer-events change), just visually receded.
  if (status === "cancelled" || status === "no_show") {
    return "bg-slate-200 text-slate-500 border-l-4 border-slate-400 line-through decoration-slate-400";
  }
  if (!isPast) {
    return needsClinicFollowUp(clientStatus, clinicReviewedAt)
      ? "bg-amber-50 text-amber-900 border-l-4 border-amber-500"
      : "bg-teal-50 text-teal-900 border-l-4 border-teal-600";
  }
  // cancelled/no_show are already handled by the early return above —
  // only "completed" counts as reviewed here.
  const isReviewed = status === "completed";
  return isReviewed
    ? "bg-slate-100 text-slate-500 border-l-4 border-slate-300"
    : "bg-rose-50 text-rose-900 border-l-4 border-rose-500";
}

/**
 * Quick-overview label shown on a past booking's week-grid chip — "Pagado",
 * "No-show", or "Cancelada" — so the clinic can scan payment/outcome state
 * without opening each chip. Null for a past booking that's still
 * unreviewed (rose chipClasses already carries that signal on its own).
 * Reuses the exact same detailModal copy the booking-detail modal itself
 * shows, so the wording never drifts between the two surfaces.
 */
export function pastResultLabel(
  booking: Pick<WeekBookingVM, "status" | "paymentStatus">,
  dict: CalendarDictionary
): string | null {
  if (booking.status === "cancelled") return dict.detailModal.resultCancelled;
  if (booking.status === "no_show") return dict.detailModal.resultNoShow;
  if (booking.paymentStatus === "paid") return dict.detailModal.paymentPaid;
  return null;
}

function DayProviderColumn({
  day,
  member,
  members,
  ranges,
  bookings,
  closures,
  gridStartMin,
  gridEndMin,
  gridHeight,
  dict,
  drag,
  onSlotClick,
  onBookingClick,
  onChipPointerDown,
}: {
  day: GridDay;
  member: WeekMemberVM;
  members: WeekMemberVM[];
  ranges: TimeRangeVM[];
  bookings: WeekBookingVM[];
  closures: ClosureRuleVM[];
  gridStartMin: number;
  gridEndMin: number;
  gridHeight: number;
  dict: CalendarDictionary;
  drag: { booking: WeekBookingVM; target: DragTarget | null } | null;
  onSlotClick: (day: GridDay, member: WeekMemberVM, clickMinute: number, ranges: TimeRangeVM[]) => void;
  onBookingClick: (booking: WeekBookingVM) => void;
  onChipPointerDown: (booking: WeekBookingVM, e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const dayBookings = bookings.filter((b) => {
    if (b.teamMemberId !== member.id) return false;
    const parts = tzDateParts(new Date(b.startIso));
    return parts.year === day.year && parts.month === day.month && parts.day === day.day;
  });

  const timeOff = day.isFestivo ? [] : memberTimeOffForDay(closures, day.year, day.month, day.day, member.id);

  // drag-to-reschedule: this column is the live drop target only when the
  // dragged booking's own provider matches this column's provider (the
  // provider never changes on drag) and the pointer is currently over this
  // day.
  const dropTarget =
    drag?.target && drag.booking.teamMemberId === member.id && drag.target.year === day.year && drag.target.month === day.month && drag.target.day === day.day
      ? drag.target
      : null;

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
          ...(ranges.length === 0 && !day.isFestivo
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
            working day's off-hours time. A festivo day always gets its own
            (bolder) stripe treatment below regardless of ranges, so it's
            never excluded here. */}
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

        {/* Festivo wash — bold diagonal hatch + amber tint, independent of
            ranges.length (so a holiday always reads this way even if working
            hours weren't separately cleared for that date — Bea/Arun
            feedback 2026-11-06: the old faint stripe only showed up
            incidentally and wasn't obvious enough as a "don't book here"
            cue). pointer-events-none so clicking to add a walk-in booking
            still works underneath. */}
        {day.isFestivo && (
          <div
            className="pointer-events-none absolute inset-0 bg-amber-100/50"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(180,83,9,0.35) 0px, rgba(180,83,9,0.35) 7px, transparent 7px, transparent 16px)",
            }}
          />
        )}

        {/* One-off provider time off — same bold diagonal-hatch treatment as
            festivo, in slate instead of amber so the two read as distinct
            ("clinic holiday" vs. "this provider is off"). Full-day spans the
            whole column; a same-day partial window is clamped to the grid's
            visible time range. */}
        {timeOff.map((t, i) => {
          if (t.fullDay) {
            return (
              <div
                key={i}
                className="pointer-events-none absolute inset-0 bg-slate-200/50"
                title={t.label ?? dict.week.festivoFallbackLabel}
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(71,85,105,0.35) 0px, rgba(71,85,105,0.35) 7px, transparent 7px, transparent 16px)",
                }}
              />
            );
          }
          const start = Math.max(t.startMin!, gridStartMin);
          const end = Math.min(t.endMin!, gridEndMin);
          if (end <= start) return null;
          const top = (start - gridStartMin) * PX_PER_MIN;
          const height = (end - start) * PX_PER_MIN;
          return (
            <div
              key={i}
              className="pointer-events-none absolute left-0 right-0 bg-slate-200/50"
              title={t.label ?? dict.week.festivoFallbackLabel}
              style={{
                top, height,
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(71,85,105,0.35) 0px, rgba(71,85,105,0.35) 7px, transparent 7px, transparent 16px)",
              }}
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
            falling through to the empty-slot "new appointment" handler.
            Also draggable (drag-to-reschedule) via onPointerDown — a
            cancelled/no_show chip's pointerdown is a no-op (startChipDrag
            bails early), so only its cursor/opacity differ, not clickability. */}
        {dayBookings.map((b) => {
          const startMin = minutesInTz(new Date(b.startIso));
          const top = (startMin - gridStartMin) * PX_PER_MIN;
          const height = Math.max(b.durationMin * PX_PER_MIN, 30);
          const isPast = new Date(b.startIso) < new Date();
          const draggable = b.status !== "cancelled" && b.status !== "no_show";
          const isDragSource = drag?.booking.id === b.id;
          return (
            <div
              key={b.id}
              onClick={(e) => { e.stopPropagation(); onBookingClick(b); }}
              onPointerDown={(e) => onChipPointerDown(b, e)}
              className={`absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1.5 py-[3px] text-[10.5px] leading-[1.2] ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${isDragSource ? "opacity-30" : ""} ${chipClasses(b.status, isPast, b.clientStatus, b.clinicReviewedAt)}`}
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
                {b.clientName}
              </div>
              <div className="truncate opacity-90">
                {timeLabel(b.startIso)} · {b.serviceName}
              </div>
              {isPast && pastResultLabel(b, dict) && (
                <div className="truncate font-semibold">{pastResultLabel(b, dict)}</div>
              )}
            </div>
          );
        })}

        {/* Drag drop-preview — a dashed ghost at the snapped target time,
            shown only in the dragged booking's own provider column (see
            dropTarget above: provider never changes on drag). */}
        {dropTarget && (
          <div
            className="pointer-events-none absolute left-0.5 right-0.5 rounded-md border-2 border-dashed border-brand bg-brand/10 px-1.5 py-[3px] text-[10.5px] font-semibold text-brand"
            style={{ top: (dropTarget.startMin - gridStartMin) * PX_PER_MIN, height: Math.max(drag!.booking.durationMin * PX_PER_MIN, 30) }}
          >
            {String(Math.floor(dropTarget.startMin / 60)).padStart(2, "0")}:{String(dropTarget.startMin % 60).padStart(2, "0")}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * multi-provider-calendar-display: Week view's merged rendering — one
 * column per day, every active provider's bookings together, each tagged
 * with a small colored provider badge (providerColorClass) since the
 * per-provider sub-column that used to disambiguate them is gone. Shares
 * DayProviderColumn's visual language (working-hours/past/festivo
 * layering, chipClasses) deliberately, just without the member-scoped
 * filtering or the member-name column header.
 */
function DayMergedColumn({
  day,
  members,
  allMembers,
  ranges,
  bookings,
  gridStartMin,
  gridEndMin,
  gridHeight,
  dict,
  drag,
  onSlotClick,
  onBookingClick,
  onAddAtBooking,
  onChipPointerDown,
}: {
  day: GridDay;
  members: WeekMemberVM[];
  allMembers: WeekMemberVM[];
  ranges: TimeRangeVM[];
  bookings: WeekBookingVM[];
  gridStartMin: number;
  gridEndMin: number;
  gridHeight: number;
  dict: CalendarDictionary;
  drag: { booking: WeekBookingVM; target: DragTarget | null } | null;
  onSlotClick: (day: GridDay, clickMinute: number, ranges: TimeRangeVM[]) => void;
  onBookingClick: (booking: WeekBookingVM) => void;
  // open-slot-plus-badge (2026-10): a small "+" on top of an existing
  // chip, shown only when at least one active provider is still free
  // during that booking's time range — clicking it opens the same
  // no-default create flow as an empty-slot click, pinned to that
  // booking's own start time instead of a raw click offset.
  onAddAtBooking: (day: GridDay, booking: WeekBookingVM, ranges: TimeRangeVM[]) => void;
  onChipPointerDown: (booking: WeekBookingVM, e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const memberIds = new Set(members.map((m) => m.id));
  const dayBookings = bookings.filter((b) => {
    if (!b.teamMemberId || !memberIds.has(b.teamMemberId)) return false;
    const parts = tzDateParts(new Date(b.startIso));
    return parts.year === day.year && parts.month === day.month && parts.day === day.day;
  });
  const clusters = clusterDayBookings(dayBookings);

  // drag-to-reschedule: unlike DayProviderColumn, the merged view has one
  // column per day (not per provider), so a drop target here only needs
  // the day to match — the dragged booking's own provider never changes,
  // so there's no provider ambiguity to resolve from drop position.
  const dropTarget =
    drag?.target && drag.target.year === day.year && drag.target.month === day.month && drag.target.day === day.day ? drag.target : null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickMinute = gridStartMin + offsetY / PX_PER_MIN;
    onSlotClick(day, clickMinute, ranges);
  };

  return (
    <div className="flex-1">
      <div className="flex h-12 flex-col items-center justify-center border-b border-line px-1">
        <span className={`text-[12px] font-semibold capitalize ${day.isPast ? "text-ink-soft" : "text-ink"}`}>
          {day.dateLabel}
        </span>
        {day.isFestivo && (
          <span className="truncate text-[10px] font-medium text-amber-700">
            ({day.festivoLabel || dict.week.festivoFallbackLabel})
          </span>
        )}
        {day.isToday && <span className="mt-0.5 h-1 w-1 rounded-full bg-brand" />}
      </div>
      <div
        className="relative overflow-hidden cursor-pointer bg-surface-2/50 hover:bg-surface-2/70"
        style={{
          height: gridHeight,
          ...(ranges.length === 0 && !day.isFestivo
            ? {
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(15,23,42,0.08) 0px, rgba(15,23,42,0.08) 6px, transparent 6px, transparent 14px)",
              }
            : {}),
        }}
        onClick={handleClick}
        title={dict.week.addAppointment}
      >
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

        {day.isPast && <div className="pointer-events-none absolute inset-0 bg-ink/5" />}
        {day.isFestivo && (
          <div
            className="pointer-events-none absolute inset-0 bg-amber-100/50"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(180,83,9,0.35) 0px, rgba(180,83,9,0.35) 7px, transparent 7px, transparent 16px)",
            }}
          />
        )}

        {Array.from({ length: Math.floor((gridEndMin - gridStartMin) / 60) + 1 }).map((_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute left-0 right-0 border-t border-line/50"
            style={{ top: i * 60 * PX_PER_MIN }}
          />
        ))}

        {clusters.map((cluster) => {
          const startMin = minutesInTz(new Date(cluster.startMs));
          const top = (startMin - gridStartMin) * PX_PER_MIN;
          const naturalHeight = Math.max(((cluster.endMs - cluster.startMs) / 60_000) * PX_PER_MIN, 30);
          const busyProviderIds = new Set(cluster.bookings.map((b) => b.teamMemberId).filter(Boolean) as string[]);
          const hasFreeProvider = members.some((m) => !busyProviderIds.has(m.id));
          const clusterKey = cluster.bookings.map((b) => b.id).join("-");

          // 1 booking in the cluster: today's normal multi-line chip,
          // untouched — no overlap to resolve, nothing to compact.
          if (cluster.bookings.length === 1) {
            const b = cluster.bookings[0];
            const isPast = new Date(b.startIso) < new Date();
            const draggable = b.status !== "cancelled" && b.status !== "no_show";
            const isDragSource = drag?.booking.id === b.id;
            return (
              <div
                key={clusterKey}
                className={`absolute left-0.5 right-0.5 flex flex-col overflow-hidden rounded-md ${isDragSource ? "opacity-30" : ""}`}
                style={{ top, height: naturalHeight }}
              >
                {hasFreeProvider && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAddAtBooking(day, b, ranges); }}
                    title={dict.week.addAppointment}
                    className="flex shrink-0 items-center justify-center bg-surface py-[1px] text-ink hover:bg-brand-weak"
                  >
                    <Icon name="plus" size={9} />
                  </button>
                )}
                <div
                  onClick={(e) => { e.stopPropagation(); onBookingClick(b); }}
                  onPointerDown={(e) => onChipPointerDown(b, e)}
                  className={`min-h-0 flex-1 overflow-hidden px-1.5 py-[3px] text-[10.5px] leading-[1.2] ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${chipClasses(b.status, isPast, b.clientStatus, b.clinicReviewedAt)}`}
                >
                  <div className="flex items-center gap-1 truncate">
                    {b.teamMemberId && (
                      <span
                        className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${providerColorClass(b.teamMemberId, allMembers)}`}
                      />
                    )}
                    {b.cancellationRequestedAt && (
                      <span title="Solicitud de cancelación pendiente" className="text-rose-600">🛑</span>
                    )}
                    {b.reminderSendFailed && (
                      <span title="Recordatorio no enviado" className="text-amber-600">⚠</span>
                    )}
                    {(b.clientStatus !== "guest_confirmed" && b.clientStatus !== "first_time") || !b.clinicReviewedAt ? (
                      <span
                        title={clientStatusLabel(b.clientStatus, b.clinicReviewedAt)}
                        className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${clientStatusDotClass(b.clientStatus, b.clinicReviewedAt)}`}
                      />
                    ) : null}
                    <span className="truncate">{b.clientName}</span>
                  </div>
                  <div className="truncate opacity-90">
                    {timeLabel(b.startIso)} · {b.serviceName}
                  </div>
                  {isPast && pastResultLabel(b, dict) && (
                    <div className="truncate font-semibold">{pastResultLabel(b, dict)}</div>
                  )}
                </div>
              </div>
            );
          }

          // 2+ overlapping bookings from different providers: per Arun's
          // call, these stack as compact single-line rows (provider dot +
          // name, service if it fits) inside ONE shared box — not split
          // side by side, which made everything unreadably narrow. The
          // grid's own time scale never changes; the box itself only
          // grows past its natural duration-based height once there isn't
          // room for every row (3+ bookings, typically) — up to 2 compact
          // rows almost always already fit inside a normal appointment's
          // natural height. Hovering a row shows the full detail via the
          // native title tooltip.
          const ROW_HEIGHT = 16;
          const rowsNeeded = cluster.bookings.length + (hasFreeProvider ? 1 : 0);
          const height = Math.max(naturalHeight, rowsNeeded * ROW_HEIGHT);

          return (
            <div
              key={clusterKey}
              className="absolute left-0.5 right-0.5 flex flex-col overflow-hidden rounded-md border border-line/60 bg-surface"
              style={{ top, height }}
            >
              {hasFreeProvider && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAddAtBooking(day, cluster.bookings[0], ranges); }}
                  title={dict.week.addAppointment}
                  className="flex shrink-0 items-center justify-center bg-surface py-[1px] text-ink hover:bg-brand-weak"
                  style={{ height: ROW_HEIGHT }}
                >
                  <Icon name="plus" size={9} />
                </button>
              )}
              {cluster.bookings.map((b) => {
                const isPast = new Date(b.startIso) < new Date();
                const providerName = allMembers.find((m) => m.id === b.teamMemberId)?.name ?? "";
                const fullDetail = [
                  providerName,
                  b.serviceName,
                  `${timeLabel(b.startIso)} · ${b.clientName}`,
                  isPast ? pastResultLabel(b, dict) : null,
                ]
                  .filter(Boolean)
                  .join(" — ");
                return (
                  <div
                    key={b.id}
                    onClick={(e) => { e.stopPropagation(); onBookingClick(b); }}
                    title={fullDetail}
                    style={{ height: ROW_HEIGHT }}
                    className={`flex shrink-0 cursor-pointer items-center gap-1 overflow-hidden px-1.5 text-[9.5px] leading-none ${chipClasses(b.status, isPast, b.clientStatus, b.clinicReviewedAt)}`}
                  >
                    {b.teamMemberId && (
                      <span
                        className={`inline-block h-[6px] w-[6px] shrink-0 rounded-full ${providerColorClass(b.teamMemberId, allMembers)}`}
                      />
                    )}
                    <span className="truncate font-medium">{b.clientName}</span>
                    {b.serviceName && <span className="truncate opacity-80">· {b.serviceName}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}

        {dropTarget && drag && (
          <div
            className="pointer-events-none absolute left-0.5 right-0.5 rounded-md border-2 border-dashed border-brand bg-brand/10 px-1.5 py-[3px] text-[10.5px] font-semibold text-brand"
            style={{ top: (dropTarget.startMin - gridStartMin) * PX_PER_MIN, height: Math.max(drag.booking.durationMin * PX_PER_MIN, 30) }}
          >
            {String(Math.floor(dropTarget.startMin / 60)).padStart(2, "0")}:{String(dropTarget.startMin % 60).padStart(2, "0")}
          </div>
        )}
      </div>
    </div>
  );
}
