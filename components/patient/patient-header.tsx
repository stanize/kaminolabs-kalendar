import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { PatientLogoutLink } from "@/components/patient/patient-logout-link";

export type PatientPage = "home" | "profile" | "bookings";

const navLinkClass =
  "text-[13px] font-medium text-ink-soft transition-colors hover:text-ink";

/**
 * Header shown on every /patient/(protected) page. Always links to the
 * OTHER pages (never the current one) as flat peer links — no back-arrow,
 * no implied hierarchy — so the patient can jump between Inicio / Perfil /
 * Todas las reservas / Cerrar sesión from anywhere in the portal.
 *
 * Deliberately does NOT include a generic "book an appointment" link here —
 * a patient can have bookings with several different clinics, and Kalendar
 * has no clinic directory, so there's no single sensible destination for
 * a portal-wide "book" action. Booking again is a per-booking action (see
 * the "Pedir nueva cita" button next to each booking row) scoped to that
 * booking's specific clinic.
 *
 * Wraps onto a second line on narrow phones rather than truncating/hiding
 * items — with only 3-4 short links this stays readable even wrapped.
 */
export function PatientHeader({
  current,
  email,
}: {
  current: PatientPage;
  email?: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-3 sm:px-8">
      <Logo size={17} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {email && (
          <span className="hidden text-[13px] text-ink-soft sm:block">{email}</span>
        )}

        {current !== "home" && (
          <Link href="/patient" className={navLinkClass}>
            Inicio
          </Link>
        )}
        {current !== "profile" && (
          <Link href="/patient/profile" className={navLinkClass}>
            Perfil
          </Link>
        )}
        {current !== "bookings" && (
          <Link href="/patient/bookings" className={navLinkClass}>
            Todas las reservas
          </Link>
        )}
        <PatientLogoutLink />
      </div>
    </header>
  );
}
