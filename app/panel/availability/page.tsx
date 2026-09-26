import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getBusinessHoursForUser } from "@/lib/availability/data";
import { AvailabilityManager } from "@/components/panel/availability-manager";
import { getLocale } from "@/lib/i18n/server";
import { getAvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";

// Weekly hours — the "Horario" tab (AvailabilityLayout renders the shared
// page header + tabs; this page owns only its own tab's content).
export default async function AvailabilityHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requireSession();
  // AvailabilityLayout already guards on the business existing and redirects
  // otherwise, so getBusinessForUser here is guaranteed non-null in practice.
  const business = await getBusinessForUser(session.user.id);
  if (!business) return null;

  const week = await getBusinessHoursForUser(session.user.id);
  const hasSavedHours = Object.keys(week).length > 0;

  const { from } = await searchParams;
  const returnToHome = from === "home";

  const locale = await getLocale();
  const dict = getAvailabilityDictionary(locale);

  return (
    // key=hasSavedHours forces a full remount when the user saves zero
    // franjas and router.refresh() flips hasSavedHours true→false. Without
    // this, useState never reinitializes on re-render and the wizard stays
    // at "review" until the user navigates away and back.
    <AvailabilityManager
      key={String(hasSavedHours)}
      dict={dict}
      initialWeek={week}
      hasSavedHours={hasSavedHours}
      bookingWindowMonths={business.booking_window_months}
      returnToHome={returnToHome}
    />
  );
}
