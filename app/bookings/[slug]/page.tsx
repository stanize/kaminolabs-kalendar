import { notFound } from "next/navigation";
import { getPublicBookingData } from "@/lib/booking/data";
import { WEEKDAY_ORDER } from "@/lib/availability/constants";
import { BookingPageShell } from "@/components/booking/booking-page-shell";
import type { Locale } from "@/lib/i18n/config";

// INTERIM: the page always starts in Spanish. FUTURE: once kalendar_businesses
// has a `language` field, read it here (e.g. business.language) and use it as
// the initial locale instead — the guest can still switch via the page's own
// switcher either way. See memory for the planned Negocio field expansion.
const INITIAL_LOCALE: Locale = "es";

export default async function BusinessPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const data = await getPublicBookingData(slug);
  if (!data) notFound();

  const { business, services, hoursByDay, members } = data;
  const openDays = WEEKDAY_ORDER.filter((d) => (hoursByDay[d]?.length ?? 0) > 0);
  const isTeam = business.team_mode === "team";

  return (
    <BookingPageShell
      slug={slug}
      business={{
        name: business.name,
        type: business.type,
        city: business.city,
        brand_color: business.brand_color,
      }}
      services={services}
      members={members}
      openDays={openDays}
      bookingWindowMonths={business.booking_window_months}
      isTeam={isTeam}
      initialLocale={INITIAL_LOCALE}
    />
  );
}
