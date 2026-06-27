import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getTeamForUser, ensureOwnerSeeded } from "@/lib/team/data";
import { TeamManager } from "@/components/panel/team-manager";

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

  // Seed the owner as a team member if not already present, so a solo user never
  // has to add themselves. Idempotent; render-safe (no revalidatePath).
  await ensureOwnerSeeded(session.user.id, session.user.name ?? "");

  const team = await getTeamForUser(session.user.id);

  const { from } = await searchParams;
  const returnToHome = from === "home";

  return (
    <div className="mx-auto max-w-[680px] px-8 py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">Tu equipo</h1>
        <p className="text-[15px] text-ink-soft">
          ¿Trabajas en solitario o con un equipo? Configúralo aquí.
        </p>
      </div>

      <TeamManager
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
