import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getCustomTimeSlotsForUser } from "@/lib/custom-slots/data";
import { getTeamForUser } from "@/lib/team/data";
import { getBusinessHoursForUser } from "@/lib/availability/data";
import { CustomTimeSlotsManager } from "@/components/panel/custom-time-slots-manager";
import { getLocale } from "@/lib/i18n/server";
import { getAvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";
import { getCustomSlotsDictionary } from "@/lib/i18n/dictionaries/custom-slots";

// "Horarios personalizados" tab (AvailabilityLayout renders the shared page
// header + tabs; this page owns only its own tab's content).
export default async function AvailabilityCustomSlotsPage() {
  const session = await requireSession();
  // AvailabilityLayout already guards on the business existing and redirects
  // otherwise, so getBusinessForUser here is guaranteed non-null in practice.
  const business = await getBusinessForUser(session.user.id);
  if (!business) return null;

  const [rules, members, hoursByDay] = await Promise.all([
    getCustomTimeSlotsForUser(session.user.id),
    getTeamForUser(session.user.id),
    getBusinessHoursForUser(session.user.id),
  ]);

  const locale = await getLocale();
  const dict = getCustomSlotsDictionary(locale);
  const availabilityDict = getAvailabilityDictionary(locale);

  return (
    <CustomTimeSlotsManager
      initialRules={rules}
      members={members.map((m) => ({ id: m.id, name: m.name }))}
      hoursByDay={hoursByDay}
      dict={dict}
      availabilityDict={availabilityDict}
    />
  );
}
