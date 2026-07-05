import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getUpcomingBookings } from "@/lib/booking/owner-data";
import { CalendarBookings } from "@/components/panel/calendar-bookings";
import { getLocale } from "@/lib/i18n/server";
import { getCalendarDictionary } from "@/lib/i18n/dictionaries/calendar";

export default async function CalendarPage() {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  if (!business) {
    redirect("/panel/business?from=home");
  }

  const bookings = await getUpcomingBookings(session.user.id);

  const locale = await getLocale();
  const dict = getCalendarDictionary(locale);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">{dict.page.title}</h1>
        <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
      </div>

      <CalendarBookings
        dict={dict}
        bookings={bookings.map((b) => ({
          id: b.id,
          serviceName: b.service_name,
          startIso: b.starts_at,
          durationMin: b.service_duration_min,
          status: b.status,
          clientName: b.client_name,
          clientEmail: b.client_email,
          clientPhone: b.client_phone,
          providerName: b.provider_name,
          pendingExpiryAt: b.pending_expiry_at,
          guestLocale: (b.guest_locale ?? "es") as "es" | "en",
        }))}
      />
    </div>
  );
}
