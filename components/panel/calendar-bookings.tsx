"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cancelBookingAsOwner, confirmBookingAsOwner } from "@/lib/actions/booking-owner";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";

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

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
}

function dayHeading(iso: string, m: CalendarDictionary["manager"], intlLocale: string): string {
  const today    = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 86400000).toISOString());
  const k = dayKey(iso);
  const label = new Intl.DateTimeFormat(intlLocale, {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long",
  }).format(new Date(iso));
  if (k === today)    return `${m.today} · ${label}`;
  if (k === tomorrow) return `${m.tomorrow} · ${label}`;
  return label;
}

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
}: {
  bookings: BookingVM[];
  dict: CalendarDictionary;
}) {
  const router = useRouter();
  const m = dict.manager;
  const [tab, setTab] = useState<"upcoming" | "pending">("upcoming");
  const [list, setList] = useState<BookingVM[]>(bookings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = list.filter((b) => b.status === "pending_confirmation").length;

  // For the Pendientes tab: sort by expiry soonest first.
  const filtered = tab === "pending"
    ? [...list]
        .filter((b) => b.status === "pending_confirmation")
        .sort((a, b) => {
          if (!a.pendingExpiryAt) return 1;
          if (!b.pendingExpiryAt) return -1;
          return new Date(a.pendingExpiryAt).getTime() - new Date(b.pendingExpiryAt).getTime();
        })
    : list;

  // Group by day (upcoming tab only; pending tab is a flat sorted list).
  const groups: { key: string; heading: string; items: BookingVM[] }[] = [];
  if (tab === "upcoming") {
    for (const b of filtered) {
      const k = dayKey(b.startIso);
      let g = groups.find((x) => x.key === k);
      if (!g) {
        g = { key: k, heading: dayHeading(b.startIso, m, dict.intlLocale), items: [] };
        groups.push(g);
      }
      g.items.push(b);
    }
  } else {
    // Pending tab: show as one flat group with no day heading.
    groups.push({ key: "pending", heading: "", items: filtered });
  }

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
        <TabBtn active={tab === "upcoming"} onClick={() => setTab("upcoming")} label={m.tabUpcoming} />
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

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft">
            <Icon name="calendar" size={22} />
          </div>
          <p className="text-[14.5px] font-semibold text-ink">
            {tab === "pending" ? m.emptyPendingTitle : m.emptyUpcomingTitle}
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">{m.emptySubtitle}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.key}>
              {g.heading && (
                <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[.04em] capitalize text-ink-soft">
                  {g.heading}
                </h2>
              )}
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                {g.items.map((b, i) => (
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
                        {b.status === "pending_confirmation" && (
                          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                            {m.pendingLabel}
                          </span>
                        )}
                        {b.status === "pending_confirmation" && b.pendingExpiryAt && (
                          <CountdownBadge expiryIso={b.pendingExpiryAt} m={m} />
                        )}
                      </p>
                      <p className="truncate text-[12.5px] text-ink-soft">
                        {b.clientName}
                        {b.providerName ? ` · ${b.providerName}` : ""}
                        {b.durationMin ? ` · ${b.durationMin} ${m.minutesUnit}` : ""}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 items-center gap-1">
                      {b.status === "pending_confirmation" && (
                        <button
                          onClick={() => handleConfirm(b.id)}
                          disabled={busyId === b.id}
                          className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-brand hover:bg-brand-weak disabled:opacity-50"
                        >
                          {busyId === b.id ? m.confirming : m.confirm}
                        </button>
                      )}
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
            </div>
          ))}
        </div>
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
