import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getClosuresForUser } from "@/lib/closures/data";
import { FestivosManager } from "@/components/panel/festivos-manager";
import { getLocale } from "@/lib/i18n/server";
import { getAvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";
import { getFestivosDictionary } from "@/lib/i18n/dictionaries/festivos";
import { getClosureConflictDictionary } from "@/lib/i18n/dictionaries/closure-conflict";

// Recurring public holidays — the "Festivos" tab (AvailabilityLayout renders
// the shared page header + tabs; this page owns only its own tab's content).
export default async function AvailabilityHolidaysPage() {
  const session = await requireSession();
  // AvailabilityLayout already guards on the business existing and redirects
  // otherwise, so getBusinessForUser here is guaranteed non-null in practice.
  const business = await getBusinessForUser(session.user.id);
  if (!business) return null;

  const closures = await getClosuresForUser(session.user.id);
  const festivos = closures.filter((c) => c.recurring);

  const locale = await getLocale();
  const dict = getAvailabilityDictionary(locale);
  const festivosDict = getFestivosDictionary(locale);
  const conflictDict = getClosureConflictDictionary(locale);

  return (
    <FestivosManager
      initialFestivos={festivos}
      intlLocale={dict.intlLocale}
      dict={festivosDict}
      conflictDict={conflictDict}
    />
  );
}
