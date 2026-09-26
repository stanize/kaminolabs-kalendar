import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getTeamForUser, ensureOwnerSeeded } from "@/lib/team/data";
import { TeamManager } from "@/components/panel/team-manager";
import { getLocale } from "@/lib/i18n/server";
import { getTeamDictionary } from "@/lib/i18n/dictionaries/team";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  // The team belongs to a business. Without one, send the user to that step.
  if (!business) {
    redirect("/panel/business?from=home");
  }

  const locale = await getLocale();
  const dict = getTeamDictionary(locale);

  // Seed the owner as a team member if not already present, so a solo user never
  // has to add themselves. Idempotent; render-safe (no revalidatePath).
  await ensureOwnerSeeded(session.user.id, session.user.name ?? "", dict.ownerFallbackName);

  const team = await getTeamForUser(session.user.id);

  const { from } = await searchParams;
  const returnToHome = from === "home";

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">{dict.page.title}</h1>
        <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
      </div>

      <TeamManager
        dict={dict}
        teamMode={business.team_mode}
        initialMembers={team.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role ?? "",
          is_owner: m.is_owner,
        }))}
        returnToHome={returnToHome}
      />
    </div>
  );
}
