import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getBusinessHoursForUser } from "@/lib/availability/data";
import { getClosuresForUser } from "@/lib/closures/data";
import { getTeamForUser, ensureOwnerSeeded } from "@/lib/team/data";
import { AvailabilityManager } from "@/components/panel/availability-manager";
import { FestivosManager } from "@/components/panel/festivos-manager";
import { ProviderTimeOffManager } from "@/components/panel/provider-time-off-manager";
import { getLocale } from "@/lib/i18n/server";
import { getAvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";
import { getFestivosDictionary } from "@/lib/i18n/dictionaries/festivos";
import { getTimeOffDictionary } from "@/lib/i18n/dictionaries/time-off";
import { getClosureConflictDictionary } from "@/lib/i18n/dictionaries/closure-conflict";

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

  const closures = await getClosuresForUser(session.user.id);
  const festivos = closures.filter((c) => c.recurring);

  // Per-provider time off (moved here from Equipo, 2026-09-26) — everything
  // schedule-related lives on Disponibilidad now. ensureOwnerSeeded so a
  // solo business (never visited Equipo) still has a member row to attach
  // time off to.
  await ensureOwnerSeeded(session.user.id, session.user.name ?? "");
  const team = await getTeamForUser(session.user.id);
  const timeOffByMember: Record<string, typeof closures> = {};
  for (const c of closures) {
    if (!c.recurring && c.team_member_id) {
      (timeOffByMember[c.team_member_id] ??= []).push(c);
    }
  }

  const { from } = await searchParams;
  const returnToHome = from === "home";

  const locale = await getLocale();
  const dict = getAvailabilityDictionary(locale);
  const festivosDict = getFestivosDictionary(locale);
  const timeOffDict = getTimeOffDictionary(locale);
  const conflictDict = getClosureConflictDictionary(locale);

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">{dict.page.title}</h1>
        <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
      </div>

      {/* key=hasSavedHours forces a full remount when the user saves zero
          franjas and router.refresh() flips hasSavedHours true→false.
          Without this, useState never reinitializes on re-render and the
          wizard stays at "review" until the user navigates away and back. */}
      <AvailabilityManager
        key={String(hasSavedHours)}
        dict={dict}
        initialWeek={week}
        hasSavedHours={hasSavedHours}
        bookingWindowMonths={business.booking_window_months}
        returnToHome={returnToHome}
      />

      <div className="mt-6">
        <FestivosManager
          initialFestivos={festivos}
          intlLocale={dict.intlLocale}
          dict={festivosDict}
          conflictDict={conflictDict}
        />
      </div>

      <div className="mt-6">
        <ProviderTimeOffManager
          members={team.map((m) => ({ id: m.id, name: m.name, isOwner: m.is_owner }))}
          timeOffByMember={timeOffByMember}
          dict={timeOffDict}
          conflictDict={conflictDict}
          intlLocale={dict.intlLocale}
        />
      </div>
    </div>
  );
}
