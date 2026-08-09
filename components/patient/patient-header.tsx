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
 * Nav always sits on its own row below the logo, on every page and every
 * screen width — NOT conditionally wrapped based on whether it fits on one
 * line. Each page omits its own link, so the link set's total width differs
 * page to page (e.g. bookings' "Inicio · Perfil · Cerrar sesión" is shorter
 * than home's "Perfil · Todas las reservas · Cerrar sesión"); wrapping only
 * when it doesn't fit meant the nav sat top-right on some pages and dropped
 * to a second, left-aligned row on others — jarring when navigating between
 * them. A fixed second row keeps the position identical everywhere.
 *
 * Deliberately does NOT include a generic "book an appointment" link here —
 * a patient can have bookings with several different clinics, and Kalendar
 * has no clinic directory, so there's no single sensible destination for
 * a portal-wide "book" action. Booking again is a per-booking action (see
 * the "Pedir nueva cita" button next to each booking row) scoped to that
 * booking's specific clinic.
 */
export function PatientHeader({
  current,
  email,
}: {
  current: PatientPage;
  email?: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface px-4 py-3 sm:px-8">
      <div className="flex items-center justify-between">
        <Logo size={17} />
        {email && (
          <span className="hidden text-[13px] text-ink-soft sm:block">{email}</span>
        )}
      </div>
      <nav className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
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
      </nav>
    </header>
  );
}
