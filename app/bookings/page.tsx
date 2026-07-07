import Link from "next/link";
import { getActiveBusinesses } from "@/lib/business/data";
import { businessTypeLabelFor } from "@/lib/i18n/dictionaries/business-types";
import { bookingPath } from "@/lib/business/booking-url";
import { Icon } from "@/components/ui/icon";

// INTERIM: directory copy is Spanish-only for now, matching the rest of the
// unauthenticated marketing surface. Revisit once this page needs full
// es/en parity like the booking wizard itself.

export default async function BookingsDirectoryPage() {
  const businesses = await getActiveBusinesses();

  return (
    <div className="mx-auto min-h-screen max-w-[720px] px-5 py-16 sm:px-8">
      <header className="mb-10">
        <h1 className="text-[clamp(28px,4vw,40px)] leading-[1.1]">Clínicas y profesionales</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
          Elige una página de reservas para pedir tu cita.
        </p>
      </header>

      {businesses.length === 0 ? (
        <p className="text-[15px] text-ink-soft">Todavía no hay páginas de reservas disponibles.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {businesses.map((b) => (
            <li key={b.slug}>
              <Link
                href={bookingPath(b.slug)}
                className="group flex items-center gap-4 rounded-2xl border border-ink/10 bg-white px-5 py-4 transition hover:border-teal/40 hover:shadow-sm"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal">
                  <Icon name="building" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium text-ink">{b.name}</span>
                  <span className="block truncate text-[14px] text-ink-soft">
                    {businessTypeLabelFor(b.type, "es")}
                    {b.city ? ` · ${b.city}` : ""}
                  </span>
                </span>
                <Icon
                  name="arrowRight"
                  className="size-4 shrink-0 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-teal"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
