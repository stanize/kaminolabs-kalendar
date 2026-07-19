"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cancelBookingAsOwner, confirmBookingAsOwner, fetchWeekBookings } from "@/lib/actions/booking-owner";
import { CalendarHeader, type CalendarViewMode } from "@/components/panel/calendar-header";
import {
  CalendarGridView,
  buildGridDays,
  type WeekMemberVM,
  type WeekBookingVM,
  type WeekServiceVM,
  type TimeRangeVM,
} from "@/components/panel/calendar-grid-view";
import { CalendarMonthView } from "@/components/panel/calendar-month-view";
import { BookingDetailModal } from "@/components/panel/booking-detail-modal";
import {
  dayStart,
  mondayStart,
  monthStart,
  monthGridBounds,
  addDaysUtc,
  addMonthsInTz,
  zonedTimeToUtc,
  tzDateParts,
} from "@/lib/calendar/client-date";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { DayId } from "@/lib/onboarding/types";

type Status = "pending_confirmation" | "confirmed" | "cancelled" | "completed";

interface BookingVM {
  id: string;
  serviceName: string;
  startIso: string;
  durationMin: number;
  status: Status;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  providerName: string | null;
  pendingExpiryAt: string | null;
  guestLocale: "es" | "en";
}

const TZ = "Europe/Madrid";

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

/** Returns remaining ms until expiry, or 0 if already expired. */
function msUntilExpiry(expiryIso: string): number {
  return Math.max(0, new Date(expiryIso).getTime() - Date.now());
}

/** Formats remaining time as "Xh Ym" */
function formatCountdown(ms: number, template: string, expiredLabel: string): string {
  if (ms <= 0) return expiredLabel;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return template.replace("{h}", String(h)).replace("{m}", String(m));
}

/** Countdown badge — ticks every minute, turns red when < 2h remaining. */
function CountdownBadge({ expiryIso, m }: { expiryIso: string; m: CalendarDictionary["manager"] }) {
  const [ms, setMs] = useState(() => msUntilExpiry(expiryIso));

  useEffect(() => {
    const id = setInterval(() => setMs(msUntilExpiry(expiryIso)), 60000);
    return () => clearInterval(id);
  }, [expiryIso]);

  const label = formatCountdown(ms, m.expiresIn, m.expired);
  const urgent = ms < 2 * 60 * 60 * 1000; // < 2 hours
  const expired = ms === 0;

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      expired ? "bg-error-weak text-error" :
      urgent  ? "bg-orange-50 text-orange-600" :
                "bg-surface-2 text-ink-soft"
    }`}>
      {label}
    </span>
  );
}

export function CalendarBookings({
  bookings,
  dict,
  weekMembers,
  weekHoursByDay,
  weekServices,
  weekInitialBookings,
  weekStartIso,
}: {
  bookings: BookingVM[];
  dict: CalendarDictionary;
  weekMembers: WeekMemberVM[];
  weekHoursByDay: Partial<Record<DayId, TimeRangeVM[]>>;
  weekServices: WeekServiceVM[];
  weekInitialBookings: WeekBookingVM[];
  weekStartIso: string;
}) {
  const router = useRouter();
  const m = dict.manager;
  const [tab, setTab] = useState<"week" | "pending">("week");
  const [list, setList] = useState<BookingVM[]>(bookings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Day/Week/Month grid state ─────────────────────────────────────────────
  // Fetching is triggered imperatively from nav handlers (not a useEffect
  // reacting to range changes) — mirrors the original week-view's goToWeek
  // pattern, and each transition (prev/next/today/view-switch/day-click)
  // fires exactly one fetch instead of one per changed dependency.
  const [view, setView] = useState<CalendarViewMode>("week");
  const [focusDate, setFocusDate] = useState<Date>(() => new Date(weekStartIso));
  const [fetchedBookings, setFetchedBookings] = useState<WeekBookingVM[] | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<{ booking: WeekBookingVM; providerName: string } | null>(null);

  const computeRange = useCallback((v: CalendarViewMode, date: Date) => {
    if (v === "day") {
      const start = dayStart(date);
      return { start, end: addDaysUtc(start, 1) };
    }
    if (v === "month") {
      const { gridStart, gridEnd } = monthGridBounds(date);
      return { start: gridStart, end: gridEnd };
    }
    const start = mondayStart(date);
    return { start, end: addDaysUtc(start, 7) };
  }, []);

  const range = useMemo(() => computeRange(view, focusDate), [computeRange, view, focusDate]);

  // Skip the redundant fetch for the very first render — the server already
  // sent weekInitialBookings for the default (week, current week) view.
  const isInitialWeek =
    view === "week" && range.start.toISOString() === new Date(weekStartIso).toISOString();

  const gridBookings = fetchedBookings ?? (isInitialWeek ? weekInitialBookings : []);

  const navigateTo = useCallback((targetView: CalendarViewMode, targetDate: Date) => {
    setView(targetView);
    setFocusDate(targetDate);
    const targetRange = computeRange(targetView, targetDate);
    const targetIsInitial =
      targetView === "week" && targetRange.start.toISOString() === new Date(weekStartIso).toISOString();
    if (targetIsInitial) { setFetchedBookings(null); return; } // falls back to weekInitialBookings, no fetch needed
    setGridLoading(true);
    fetchWeekBookings(targetRange.start.toISOString(), targetRange.end.toISOString())
      .then(setFetchedBookings)
      .finally(() => setGridLoading(false));
  }, [computeRange, weekStartIso]);

  const rangeLabel = useMemo(() => {
    if (view === "day") {
      return new Intl.DateTimeFormat(dict.intlLocale, {
        timeZone: TZ, weekday: "long", day: "numeric", month: "long",
      }).format(range.start);
    }
    if (view === "month") {
      return new Intl.DateTimeFormat(dict.intlLocale, {
        timeZone: TZ, month: "long", year: "numeric",
      }).format(monthStart(focusDate));
    }
    const days = buildGridDays(range.start, 7, dict.intlLocale);
    return dict.week.weekRangeTemplate
      .replace("{from}", days[0]?.dateLabel ?? "")
      .replace("{to}", days[6]?.dateLabel ?? "");
  }, [view, range, dict, focusDate]);

  const handlePrev = () => {
    if (view === "day") navigateTo("day", addDaysUtc(focusDate, -1));
    else if (view === "week") navigateTo("week", addDaysUtc(focusDate, -7));
    else navigateTo("month", addMonthsInTz(focusDate, -1));
  };
  const handleNext = () => {
    if (view === "day") navigateTo("day", addDaysUtc(focusDate, 1));
    else if (view === "week") navigateTo("week", addDaysUtc(focusDate, 7));
    else navigateTo("month", addMonthsInTz(focusDate, 1));
  };
  const handleToday = () => navigateTo(view, new Date());
  const handleViewChange = (v: CalendarViewMode) => {
    if (v === "day" && view === "week") {
      const now = new Date();
      const isTodayInRange = now >= range.start && now < range.end;
      navigateTo("day", isTodayInRange ? now : focusDate);
      return;
    }
    navigateTo(v, focusDate);
  };

  const handleSelectDay = (year: number, month: number, day: number) => {
    navigateTo("day", zonedTimeToUtc(year, month, day, 12, 0));
  };

  const handleGridBookingCreated = () => navigateTo(view, focusDate); // force a refetch of the current range

  const gridDays = useMemo(
    () => buildGridDays(range.start, view === "day" ? 1 : 7, dict.intlLocale),
    [range.start, view, dict.intlLocale]
  );

  // ── Pendientes tab (unchanged) ────────────────────────────────────────────
  const pendingCount = list.filter((b) => b.status === "pending_confirmation").length;

  // Pendientes tab: flat list, sorted by expiry soonest first.
  const pending = [...list]
    .filter((b) => b.status === "pending_confirmation")
    .sort((a, b) => {
      if (!a.pendingExpiryAt) return 1;
      if (!b.pendingExpiryAt) return -1;
      return new Date(a.pendingExpiryAt).getTime() - new Date(b.pendingExpiryAt).getTime();
    });

  const handleCancel = useCallback(async (id: string) => {
    setError(null);
    setBusyId(id);
    const prev = list;
    setList((l) => l.filter((b) => b.id !== id));
    try {
      const res = await cancelBookingAsOwner(id, dict.errors);
      if (!res.ok) { setList(prev); setError(res.error); }
    } catch {
      setList(prev); setError(m.errCancelFailed);
    } finally {
      setBusyId(null);
      router.refresh();
    }
  }, [list, dict.errors, m.errCancelFailed, router]);

  const handleConfirm = useCallback(async (id: string) => {
    setError(null);
    setBusyId(id);
    const prev = list;
    // Optimistically move to confirmed.
    setList((l) => l.map((b) => b.id === id ? { ...b, status: "confirmed" as Status, pendingExpiryAt: null } : b));
    try {
      const res = await confirmBookingAsOwner(id, dict.errors);
      if (!res.ok) { setList(prev); setError(res.error); }
    } catch {
      setList(prev); setError(m.errCancelFailed);
    } finally {
      setBusyId(null);
      router.refresh();
    }
  }, [list, dict.errors, m.errCancelFailed, router]);

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs */}
      <div className="flex gap-2">
        <TabBtn active={tab === "week"} onClick={() => setTab("week")} label={m.tabWeek} />
        <TabBtn
          active={tab === "pending"}
          onClick={() => setTab("pending")}
          label={m.tabPending}
          badge={pendingCount > 0 ? pendingCount : undefined}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {tab === "week" && (
        <div className="flex flex-col gap-3">
          <CalendarHeader
            view={view}
            onViewChange={handleViewChange}
            rangeLabel={rangeLabel}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
            loading={gridLoading}
            dict={dict.week}
          />

          {view === "month" ? (
            <CalendarMonthView
              gridStart={range.start}
              currentMonth={tzDateParts(focusDate).month}
              bookings={gridBookings}
              dict={dict}
              onSelectDay={handleSelectDay}
            />
          ) : (
            <CalendarGridView
              view={view}
              days={gridDays}
              members={weekMembers}
              hoursByDay={weekHoursByDay}
              services={weekServices}
              bookings={gridBookings}
              dict={dict}
              onBookingCreated={handleGridBookingCreated}
              onBookingClick={(booking, providerName) => setSelectedBooking({ booking, providerName })}
            />
          )}
        </div>
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking.booking}
          providerName={selectedBooking.providerName}
          intlLocale={dict.intlLocale}
          dict={dict.detailModal}
          errorsDict={dict.errors}
          onClose={() => setSelectedBooking(null)}
          onUpdated={handleGridBookingCreated}
        />
      )}

      {tab === "pending" && (
        pending.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft">
              <Icon name="calendar" size={22} />
            </div>
            <p className="text-[14.5px] font-semibold text-ink">{m.emptyPendingTitle}</p>
            <p className="mt-1 text-[13px] text-ink-soft">{m.emptySubtitle}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {pending.map((b, i) => (
              <div
                key={b.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}
              >
                <div className="w-[52px] shrink-0 text-[15px] font-semibold text-ink">
                  {timeLabel(b.startIso)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-ink">
                    <span className="truncate">{b.serviceName}</span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                      {m.pendingLabel}
                    </span>
                    {b.pendingExpiryAt && <CountdownBadge expiryIso={b.pendingExpiryAt} m={m} />}
                  </p>
                  <p className="truncate text-[12.5px] text-ink-soft">
                    {b.clientName}
                    {b.providerName ? ` · ${b.providerName}` : ""}
                    {b.durationMin ? ` · ${b.durationMin} ${m.minutesUnit}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleConfirm(b.id)}
                    disabled={busyId === b.id}
                    className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-brand hover:bg-brand-weak disabled:opacity-50"
                  >
                    {busyId === b.id ? m.confirming : m.confirm}
                  </button>
                  <button
                    onClick={() => handleCancel(b.id)}
                    disabled={busyId === b.id}
                    className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft hover:bg-error-weak hover:text-error disabled:opacity-50"
                  >
                    {m.cancel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function TabBtn({
  active, onClick, label, badge,
}: {
  active: boolean; onClick: () => void; label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
        active ? "bg-brand text-white" : "bg-surface text-ink-soft hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {label}
      {badge !== undefined && (
        <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold ${
          active ? "bg-white/25 text-white" : "bg-brand-weak text-brand-ink"
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}
