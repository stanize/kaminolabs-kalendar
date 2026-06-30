import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getBusinessHoursForUser } from "@/lib/availability/data";
import { AvailabilityManager } from "@/components/panel/availability-manager";
import { getLocale } from "@/lib/i18n/server";
import { getAvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  if (!business) {
    redirect("/panel/business?from=home");
  }

  const week = await getBusinessHoursForUser(session.user.id);
  const hasSavedHours = Object.keys(week).length > 0;

  const { from } = await searchParams;
  const returnToHome = from === "home";

  const locale = await getLocale();
  const dict = getAvailabilityDictionary(locale);

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">{dict.page.title}</h1>
        <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
      </div>

      <AvailabilityManager
        dict={dict}
        initialWeek={week}
        hasSavedHours={hasSavedHours}
        bookingWindowMonths={business.booking_window_months}
        returnToHome={returnToHome}
      />
    </div>
  );
}
