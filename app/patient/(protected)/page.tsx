import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth-session";
import { getPatientProfile } from "@/lib/actions/patient";
import { getPatientBookings } from "@/lib/booking/patient-data";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { bookingPath } from "@/lib/business/booking-url";

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
    confirmed:           { label: "Confirmada",  className: "bg-brand-weak text-brand-ink border-brand-line" },
    pending_confirmation:{ label: "Pendiente",   className: "bg-surface-2 text-ink-soft border-line" },
    cancelled:           { label: "Cancelada",   className: "bg-error-weak text-error border-error" },
    completed:           { label: "Completada",  className: "bg-surface-2 text-ink-soft border-line" },
  };
  const s = map[status] ?? map.completed;
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}

export default async function PatientDashboardPage() {
  const session = await requireSession();
  const profile = await getPatientProfile();
  if (!profile) redirect("/patient/login");

  const allBookings = await getPatientBookings(profile.id);
  const now = new Date();

  const upcoming = allBookings.filter(
    (b) => new Date(b.startsAt) >= now && b.status !== "cancelled"
  );
  const past = allBookings.filter(
    (b) => new Date(b.startsAt) < now || b.status === "cancelled"
  );

  const firstName = session.user.name?.split(" ")[0] ?? "Cliente";

  return (
    <div className="min-h-screen bg-surface-2">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-8">
        <Logo size={17} />
        <div className="flex items-center gap-3">
          <span className="hidden text-[13px] text-ink-soft sm:block">{session.user.email}</span>
          <Link
            href="/patient/bookings"
            className="text-[13px] font-medium text-ink-soft hover:text-ink"
          >
            Todas las reservas
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6">
          <h1 className="mb-1 text-[24px]">Hola, {firstName}</h1>
          <p className="text-[15px] text-ink-soft">Tus próximas citas y reservas.</p>
        </div>

        {/* Upcoming */}
        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.04em] text-ink-soft">
            Próximas ({upcoming.length})
          </h2>

          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft">
                <Icon name="calendar" size={22} />
              </div>
              <p className="text-[14.5px] font-semibold text-ink">No tienes citas próximas</p>
              <p className="mt-1 text-[13px] text-ink-soft">
                Busca una clínica y reserva tu primera cita.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((b) => (
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
                  <Link
                    href={bookingPath(b.businessSlug)}
                    className="shrink-0 rounded-lg p-1.5 text-ink-soft hover:bg-surface-2 hover:text-ink"
                    aria-label="Ver página del negocio"
                  >
                    <Icon name="externalLink" size={15} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past (last 3) */}
        {past.length > 0 && (
          <section>
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.04em] text-ink-soft">
              Recientes
            </h2>
            <div className="flex flex-col gap-2">
              {past.slice(0, 3).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 opacity-70"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">
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
                </div>
              ))}
            </div>
            {past.length > 3 && (
              <div className="mt-3 text-center">
                <Link
                  href="/patient/bookings"
                  className="text-[13px] font-medium text-brand hover:underline"
                >
                  Ver todas ({past.length} anteriores)
                </Link>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
