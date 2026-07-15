import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getPublicBookingData } from "@/lib/booking/data";
import { WEEKDAY_ORDER } from "@/lib/availability/constants";
import { BookingPageShell } from "@/components/booking/booking-page-shell";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/roles/data";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n/config";

// INTERIM: the page always starts in Spanish. FUTURE: once kalendar_businesses
// has a `language` field, read it here (e.g. business.language) and use it as
// the initial locale instead. See memory for the planned Negocio field expansion.
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

  // Check if there's an authenticated patient session. If so, pass their
  // profile down so the wizard can skip the auth gate and book immediately.
  let initialPatient: { id: string; name: string; email: string } | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      const isPatient = await hasRole(session.user.id, "patient");
      if (isPatient) {
        const supabase = await createClient();
        const { data: patient } = await supabase
          .from("kalendar_patients")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (patient) {
          initialPatient = {
            id: patient.id,
            name: session.user.name ?? "",
            email: session.user.email ?? "",
          };
        }
      }
    }
  } catch {
    // No session or error — treat as unauthenticated guest.
  }

  // Single-line display address for the booking page header — replaces the
  // business-type/city line, which isn't very useful to a patient deciding
  // whether to book. Kept as plain formatting here rather than a DB column
  // since it's just a presentation concern over existing address_* fields.
  const addressLine = [
    `${business.address_street} ${business.address_number}${business.address_additional ? `, ${business.address_additional}` : ""}`,
    business.city,
  ].join(" · ");

  return (
    <BookingPageShell
      slug={slug}
      business={{
        name: business.name,
        address: addressLine,
        brand_color: business.brand_color,
      }}
      services={services}
      members={members}
      openDays={openDays}
      bookingWindowMonths={business.booking_window_months}
      isTeam={isTeam}
      initialLocale={INITIAL_LOCALE}
      initialPatient={initialPatient}
    />
  );
}
