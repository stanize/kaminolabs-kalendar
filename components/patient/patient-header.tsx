import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";

export type PatientPage = "home" | "profile" | "bookings";

const navLinkClass =
  "text-[13px] font-medium text-ink-soft transition-colors hover:text-ink";

/**
 * Header shown on every /patient/(protected) page. Always links to the
 * OTHER pages (never the current one), so the patient can jump between
 * Inicio / Perfil / Todas las reservas from anywhere in the portal, instead
 * of only being able to go "back" to the dashboard.
 *
 * Deliberately does NOT include a generic "book an appointment" link here —
 * a patient can have bookings with several different clinics, and Kalendar
 * has no clinic directory, so there's no single sensible destination for
 * a portal-wide "book" action. Booking again is a per-booking action (see
 * the "Pedir nueva cita" link next to each booking row) scoped to that
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
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-8">
      <Logo size={17} />
      <div className="flex items-center gap-4">
        {email && (
          <span className="hidden text-[13px] text-ink-soft sm:block">{email}</span>
        )}

        {current !== "home" && (
          <Link href="/patient" className={`flex items-center gap-1.5 ${navLinkClass}`}>
            <Icon name="chevronLeft" size={15} /> Inicio
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
      </div>
    </header>
  );
}
