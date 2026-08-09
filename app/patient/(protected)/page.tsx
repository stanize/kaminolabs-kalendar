import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth-session";
import { getPatientProfile } from "@/lib/actions/patient";
import { getPatientBookings } from "@/lib/booking/patient-data";
import { Icon } from "@/components/ui/icon";
import { DashboardUpcomingList } from "@/components/patient/dashboard-upcoming-list";
import { PatientHeader } from "@/components/patient/patient-header";
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
      <PatientHeader current="home" email={session.user.email} />

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

          <DashboardUpcomingList bookings={upcoming} />
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
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3.5 opacity-70"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">
                    <Icon name="calendar" size={18} />
                  </div>
                  <div className="min-w-[160px] flex-1 basis-0">
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
                    className="ml-auto shrink-0 rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:brightness-95"
                  >
                    Pedir nueva cita
                  </Link>
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
