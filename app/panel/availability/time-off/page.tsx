import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getClosuresForUser } from "@/lib/closures/data";
import { getTeamForUser, ensureOwnerSeeded } from "@/lib/team/data";
import { TimeOffManager } from "@/components/panel/time-off-list";
import { getLocale } from "@/lib/i18n/server";
import { getAvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";
import { getTimeOffDictionary } from "@/lib/i18n/dictionaries/time-off";
import { getClosureConflictDictionary } from "@/lib/i18n/dictionaries/closure-conflict";

// Team-wide vacations/time-off — the "Vacaciones y ausencias" tab
// (AvailabilityLayout renders the shared page header + tabs; this page owns
// only its own tab's content). Flattened (2026-10-31) to a single list +
// single add button across all providers, with the provider picked inside
// the panel — replaces the earlier one-expandable-section-per-provider UI.
export default async function AvailabilityTimeOffPage() {
  const session = await requireSession();
  // AvailabilityLayout already guards on the business existing and redirects
  // otherwise, so getBusinessForUser here is guaranteed non-null in practice.
  const business = await getBusinessForUser(session.user.id);
  if (!business) return null;

  const closures = await getClosuresForUser(session.user.id);

  // ensureOwnerSeeded so a solo business (never visited Equipo) still has a
  // member row to attach time off to.
  await ensureOwnerSeeded(session.user.id, session.user.name ?? "");
  const team = await getTeamForUser(session.user.id);
  const entries = closures
    .filter((c) => !c.recurring && c.team_member_id)
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));

  const locale = await getLocale();
  const dict = getAvailabilityDictionary(locale);
  const timeOffDict = getTimeOffDictionary(locale);
  const conflictDict = getClosureConflictDictionary(locale);

  return (
    <TimeOffManager
      members={team.map((m) => ({ id: m.id, name: m.name }))}
      initialEntries={entries}
      dict={timeOffDict}
      conflictDict={conflictDict}
      intlLocale={dict.intlLocale}
    />
  );
}
