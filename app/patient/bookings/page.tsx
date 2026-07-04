import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth-session";
import { getPatientProfile } from "@/lib/actions/patient";
import { getPatientBookings } from "@/lib/booking/patient-data";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";

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

export default async function PatientBookingsPage() {
  await requireSession();
  const profile = await getPatientProfile();
  if (!profile) redirect("/patient/login");

  const bookings = await getPatientBookings(profile.id);
  const now = new Date();

  const upcoming = bookings.filter(
    (b) => new Date(b.startsAt) >= now && b.status !== "cancelled"
  );
  const past = bookings.filter(
    (b) => new Date(b.startsAt) < now || b.status === "cancelled"
  );

  function BookingRow({ b }: { b: typeof bookings[0] }) {
    return (
      <div className="flex items-start gap-4 border-t border-line px-4 py-4 first:border-t-0">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">
          <Icon name="calendar" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-ink">{b.serviceName}</span>
            {statusBadge(b.status)}
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
    );
  }

  return (
    <div className="min-h-screen bg-surface-2">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-8">
        <Logo size={17} />
        <Link
          href="/patient"
          className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink"
        >
          <Icon name="chevronLeft" size={15} /> Inicio
        </Link>
      </header>

      <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-6 text-[24px]">Todas tus reservas</h1>

        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft">
              <Icon name="calendar" size={22} />
            </div>
            <p className="text-[14.5px] font-semibold text-ink">No tienes reservas todavía</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              Tus citas aparecerán aquí.
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
