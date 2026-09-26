import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { createClient } from "@/lib/supabase/server";
import {
  getClientRowBookings,
  getPendingCancellationRequests,
  getWeekCalendarData,
  getDefaultCalendarWeekBounds,
  getHoyWidgetStats,
  getWeekWidgetStats,
  getConflictingBookingsForUser,
} from "@/lib/booking/owner-data";
import { CalendarBookings } from "@/components/panel/calendar-bookings";
import { getClosuresForUser } from "@/lib/closures/data";
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

  const supabase = await createClient();
  const [bookings, cancellationRequests, weekData, hoyStats, weekStats, initialConflicts, whatsappConfig, closures] = await Promise.all([
    getClientRowBookings(session.user.id),
    getPendingCancellationRequests(session.user.id),
    getWeekCalendarData(session.user.id, weekStartIso, weekEndIso),
    getHoyWidgetStats(session.user.id),
    getWeekWidgetStats(session.user.id),
    getConflictingBookingsForUser(session.user.id),
    supabase
      .from("kalendar_whatsapp_config")
      .select("enabled")
      .eq("business_id", business.id)
      .maybeSingle(),
    getClosuresForUser(session.user.id),
  ]);
  const whatsappEnabled = whatsappConfig.data?.enabled ?? false;
  // holidays-and-time-off (2026-09-26): recurring, clinic-wide festivos only
  // — the panel calendar's "festivo" column visual (background wash + name
  // under the date) never applies to a one-off provider vacation/time-off,
  // which stays visible only via the Conflictos tab as before.
  const festivos = closures
    .filter((c) => c.recurring)
    .map((c) => ({ month: c.month!, day: c.day!, label: c.label }));
  // Client-safe projection of every closure (festivos + provider time off)
  // for the manual booking modal's non-blocking closure-warning check.
  const closureRules = closures.map((c) => ({
    teamMemberId: c.team_member_id,
    recurring: c.recurring,
    month: c.month,
    day: c.day,
    startDate: c.start_date,
    endDate: c.end_date,
    startTime: c.start_time,
    endTime: c.end_time,
    label: c.label,
  }));

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
          cancellationRequestedAt: b.cancellation_requested_at,
          clientStatus: b.clientStatus,
          clinicReviewedAt: b.clinic_reviewed_at,
        }))}
        cancellationRequests={cancellationRequests.map((b) => ({
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
          cancellationRequestedAt: b.cancellation_requested_at,
          clientStatus: b.clientStatus,
          clinicReviewedAt: b.clinic_reviewed_at,
        }))}
        weekMembers={(weekData?.members ?? []).map((m) => ({ id: m.id, name: m.name, isOwner: m.isOwner }))}
        weekHoursByDay={weekData?.hoursByDay ?? {}}
        weekServices={(weekData?.services ?? []).map((s) => ({
          id: s.id, name: s.name, durationMin: s.durationMin, price: s.price,
        }))}
        weekInitialBookings={(weekData?.bookings ?? []).map((b) => ({
          id: b.id,
          serviceId: b.serviceId,
          serviceName: b.serviceName,
          startIso: b.startIso,
          endIso: b.endIso,
          durationMin: b.durationMin,
          status: b.status,
          paymentStatus: b.paymentStatus,
          paymentMethod: b.paymentMethod,
          bonoPurchaseId: b.bonoPurchaseId,
          clinicClientId: b.clinicClientId,
          clientName: b.clientName,
          clientEmail: b.clientEmail,
          clientPhone: b.clientPhone,
          notes: b.notes,
          teamMemberId: b.teamMemberId,
          pendingExpiryAt: b.pendingExpiryAt,
          guestLocale: b.guestLocale,
          reminderSendFailed: b.reminderSendFailed,
          lastReminderError: b.lastReminderError,
          cancellationRequestedAt: b.cancellationRequestedAt,
          clientStatus: b.clientStatus,
          clinicReviewedAt: b.clinicReviewedAt,
        }))}
        weekStartIso={weekStartIso}
        whatsappEnabled={whatsappEnabled}
        initialConflicts={initialConflicts}
        festivos={festivos}
        closures={closureRules}
      />
    </div>
  );
}
