"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { PatientCancelButton } from "@/components/patient/patient-cancel-button";
import { bookingPath } from "@/lib/business/booking-url";
import type { PatientBooking } from "@/lib/booking/patient-data";

const TZ = "Europe/Madrid";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    confirmed:            { label: "Confirmada",   className: "bg-brand-weak text-brand-ink border-brand-line" },
    pending_confirmation: { label: "Pendiente",    className: "bg-surface-2 text-ink-soft border-line" },
    cancelled:            { label: "Cancelada",    className: "bg-error-weak text-error border-error" },
    completed:            { label: "Completada",   className: "bg-surface-2 text-ink-soft border-line" },
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

export function PatientBookingsList({ bookings }: { bookings: PatientBooking[] }) {
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const visible = bookings.map((b) => {
    if (cancelledIds.has(b.id)) return { ...b, status: "cancelled" as const };
    if (requestedIds.has(b.id)) return { ...b, cancellationRequestedAt: new Date().toISOString() };
    return b;
  });

  const upcoming = visible.filter(
    (b) => new Date(b.startsAt) >= new Date() && b.status !== "cancelled"
  );
  const past = visible.filter(
    (b) => new Date(b.startsAt) < new Date() || b.status === "cancelled"
  );

  function BookingRow({ b }: { b: PatientBooking }) {
    const cancellable =
      ["pending_confirmation", "confirmed"].includes(b.status) && !b.cancellationRequestedAt;
    return (
      <div className="flex flex-col gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:flex-row sm:items-start">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">
            <Icon name="calendar" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold text-ink">{b.serviceName}</span>
              {b.cancellationRequestedAt && b.status !== "cancelled" ? (
                <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-soft">
                  Cancelación solicitada
                </span>
              ) : (
                statusBadge(b.status)
              )}
            </div>
            <p className="mt-0.5 text-[13px] font-medium text-ink">{b.businessName}</p>
            <p className="capitalize text-[12.5px] text-ink-soft">{formatWhen(b.startsAt)}</p>
            {b.providerName && (
              <p className="text-[12.5px] text-ink-soft">{b.providerName}</p>
            )}
            <p className="text-[12.5px] text-ink-soft">
              {b.durationMin} min · {b.servicePrice === 0 ? "Gratis" : `${b.servicePrice} €`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-14 sm:ml-auto sm:pl-0">
          <Link
            href={bookingPath(b.businessSlug)}
            className="rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:brightness-95"
          >
            Pedir nueva cita
          </Link>
          {cancellable && (
            <PatientCancelButton
              bookingId={b.id}
              serviceName={b.serviceName}
              businessName={b.businessName}
              whenLabel={formatWhen(b.startsAt)}
              labels={CANCEL_LABELS}
              onCancelled={(requested) =>
                requested
                  ? setRequestedIds((prev) => new Set(prev).add(b.id))
                  : setCancelledIds((prev) => new Set(prev).add(b.id))
              }
            />
          )}
        </div>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft">
          <Icon name="calendar" size={22} />
        </div>
        <p className="text-[14.5px] font-semibold text-ink">No tienes reservas todavía</p>
        <p className="mt-1 text-[13px] text-ink-soft">Tus citas aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[.04em] text-ink-soft">
            Próximas ({upcoming.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {upcoming.map((b) => <BookingRow key={b.id} b={b} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[.04em] text-ink-soft">
            Anteriores ({past.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {past.map((b) => <BookingRow key={b.id} b={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}
