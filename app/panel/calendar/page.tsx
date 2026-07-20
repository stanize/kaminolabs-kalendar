import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import {
  getUpcomingBookings,
  getWeekCalendarData,
  getDefaultCalendarWeekBounds,
  getHoyWidgetStats,
  getWeekWidgetStats,
} from "@/lib/booking/owner-data";
import { CalendarBookings } from "@/components/panel/calendar-bookings";
import { TodayStatsWidget } from "@/components/panel/today-stats-widget";
import { WeekStatsWidget } from "@/components/panel/week-stats-widget";
import { getLocale } from "@/lib/i18n/server";
import { getCalendarDictionary } from "@/lib/i18n/dictionaries/calendar";

export default async function CalendarPage() {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  if (!business) {
    redirect("/panel/business?from=home");
  }

  const { weekStartIso, weekEndIso } = await getDefaultCalendarWeekBounds(session.user.id);

  const [bookings, weekData, hoyStats, weekStats] = await Promise.all([
    getUpcomingBookings(session.user.id),
    getWeekCalendarData(session.user.id, weekStartIso, weekEndIso),
    getHoyWidgetStats(session.user.id),
    getWeekWidgetStats(session.user.id),
  ]);

  const locale = await getLocale();
  const dict = getCalendarDictionary(locale);
  const hoyDayLabel = hoyStats.isToday || !hoyStats.dateIso ? undefined : new Intl.DateTimeFormat(dict.intlLocale, {
    timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long",
  }).format(new Date(`${hoyStats.dateIso}T12:00:00Z`));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[24px]">{dict.page.title}</h1>
          <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <TodayStatsWidget
            isToday={hoyStats.isToday}
            count={hoyStats.count}
            dayLabel={hoyDayLabel}
            dict={dict.widget}
          />
          <WeekStatsWidget
            isThisWeek={weekStats.isThisWeek}
            count={weekStats.count}
            dict={dict.widget}
          />
        </div>
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
        weekMembers={(weekData?.members ?? []).map((m) => ({ id: m.id, name: m.name, isOwner: m.isOwner }))}
        weekHoursByDay={weekData?.hoursByDay ?? {}}
        weekServices={(weekData?.services ?? []).map((s) => ({
          id: s.id, name: s.name, durationMin: s.durationMin, price: s.price,
        }))}
        weekInitialBookings={(weekData?.bookings ?? []).map((b) => ({
          id: b.id,
          serviceName: b.serviceName,
          startIso: b.startIso,
          endIso: b.endIso,
          durationMin: b.durationMin,
          status: b.status,
          paymentStatus: b.paymentStatus,
          clientName: b.clientName,
          clientEmail: b.clientEmail,
          clientPhone: b.clientPhone,
          teamMemberId: b.teamMemberId,
          pendingExpiryAt: b.pendingExpiryAt,
          guestLocale: b.guestLocale,
        }))}
        weekStartIso={weekStartIso}
      />
    </div>
  );
}
