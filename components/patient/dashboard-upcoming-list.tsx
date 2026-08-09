"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { bookingPath } from "@/lib/business/booking-url";
import { PatientCancelButton } from "@/components/patient/patient-cancel-button";
import type { PatientBooking } from "@/lib/booking/patient-data";

const TZ = "Europe/Madrid";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    confirmed:            { label: "Confirmada",  className: "bg-brand-weak text-brand-ink border-brand-line" },
    pending_confirmation: { label: "Pendiente",   className: "bg-surface-2 text-ink-soft border-line" },
    cancelled:            { label: "Cancelada",   className: "bg-error-weak text-error border-error" },
    completed:            { label: "Completada",  className: "bg-surface-2 text-ink-soft border-line" },
  };
  const s = map[status] ?? map.completed;
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}

const CANCEL_LABELS = {
  cancel: "Cancelar",
  confirm: "Sí, cancelar",
  cancelling: "Cancelando…",
  keep: "No",
};

// Owns local cancelled-status overrides so the row shows the "Cancelada"
// badge the instant a cancellation succeeds — no page reload/refetch wait,
// even though router.refresh() also runs in the background to resync.
export function DashboardUpcomingList({ bookings }: { bookings: PatientBooking[] }) {
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  // Cancelled rows stay in place (badge flips to "Cancelada" instantly) rather
  // than disappearing — the patient gets immediate visual confirmation their
  // cancel action worked, without the list jumping around under them.
  const visible = bookings.map((b) =>
    cancelledIds.has(b.id) ? { ...b, status: "cancelled" as const } : b
  );

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft">
          <Icon name="calendar" size={22} />
        </div>
        <p className="text-[14.5px] font-semibold text-ink">No tienes citas próximas</p>
        <p className="mt-1 text-[13px] text-ink-soft">
          Busca una clínica y reserva tu primera cita.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3.5"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-weak text-brand">
            <Icon name="calendar" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <span className="truncate">{b.serviceName}</span>
              {statusBadge(b.status)}
            </p>
            <p className="truncate text-[12.5px] text-ink-soft capitalize">
              {b.businessName} · {formatWhen(b.startsAt)}
            </p>
          </div>
          {["pending_confirmation", "confirmed"].includes(b.status) && (
            <PatientCancelButton
              bookingId={b.id}
              labels={CANCEL_LABELS}
              onCancelled={() => setCancelledIds((prev) => new Set(prev).add(b.id))}
            />
          )}
          <Link
            href={bookingPath(b.businessSlug)}
            className="shrink-0 text-[12px] font-medium text-brand hover:underline"
          >
            Pedir nueva cita
          </Link>
        </div>
      ))}
    </div>
  );
}
