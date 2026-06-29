"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cancelBookingAsOwner } from "@/lib/actions/booking-owner";

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
}

const TZ = "Europe/Madrid";

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
}
function dayHeading(iso: string): string {
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 86400000).toISOString());
  const k = dayKey(iso);
  const label = new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long",
  }).format(new Date(iso));
  if (k === today) return `Hoy · ${label}`;
  if (k === tomorrow) return `Mañana · ${label}`;
  return label;
}
function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export function CalendarBookings({ bookings }: { bookings: BookingVM[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "pending">("upcoming");
  const [list, setList] = useState<BookingVM[]>(bookings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = tab === "pending" ? list.filter((b) => b.status === "pending_confirmation") : list;
  const pendingCount = list.filter((b) => b.status === "pending_confirmation").length;

  // Group by day, preserving chronological order.
  const groups: { key: string; heading: string; items: BookingVM[] }[] = [];
  for (const b of filtered) {
    const k = dayKey(b.startIso);
    let g = groups.find((x) => x.key === k);
    if (!g) {
      g = { key: k, heading: dayHeading(b.startIso), items: [] };
      groups.push(g);
    }
    g.items.push(b);
  }

  async function cancel(id: string) {
    setError(null);
    setBusyId(id);
    const prev = list;
    setList((l) => l.filter((b) => b.id !== id)); // optimistic
    try {
      const res = await cancelBookingAsOwner(id);
      if (!res.ok) {
        setList(prev);
        setError(res.error);
      }
    } catch {
      setList(prev);
      setError("No se pudo cancelar. Inténtalo de nuevo.");
    } finally {
      setBusyId(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs */}
      <div className="flex gap-2">
        <TabBtn active={tab === "upcoming"} onClick={() => setTab("upcoming")} label="Próximas" />
        <TabBtn
          active={tab === "pending"}
          onClick={() => setTab("pending")}
          label="Pendientes"
          badge={pendingCount > 0 ? pendingCount : undefined}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft">
            <Icon name="calendar" size={22} />
          </div>
          <p className="text-[14.5px] font-semibold text-ink">
            {tab === "pending" ? "No hay reservas pendientes" : "No tienes reservas próximas"}
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">
            Las reservas de tu página aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.key}>
              <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[.04em] capitalize text-ink-soft">
                {g.heading}
              </h2>
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                {g.items.map((b, i) => (
                  <div
                    key={b.id}
                    className={`flex items-center gap-4 px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}
                  >
                    <div className="w-[52px] shrink-0 text-[15px] font-semibold text-ink">
                      {timeLabel(b.startIso)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                        <span className="truncate">{b.serviceName}</span>
                        {b.status === "pending_confirmation" && (
                          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                            Pendiente
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[12.5px] text-ink-soft">
                        {b.clientName}
                        {b.providerName ? ` · ${b.providerName}` : ""}
                        {b.durationMin ? ` · ${b.durationMin} min` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => cancel(b.id)}
                      disabled={busyId === b.id}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft hover:bg-error-weak hover:text-error disabled:opacity-50"
                    >
                      Cancelar
                    </button>
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
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
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
        <span
          className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold ${
            active ? "bg-white/25 text-white" : "bg-brand-weak text-brand-ink"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
