import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { assignRole, getUserRoles } from "@/lib/roles/data";
import { PanelSidebar } from "@/components/panel/sidebar";
import { EmailVerificationGate } from "@/components/panel/email-verification-gate";
import { RoleUpgradeGate } from "@/components/panel/role-upgrade-gate";
import { getPanelShellServerDictionary } from "@/lib/i18n/server";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/signin");

  const { locale, dict } = await getPanelShellServerDictionary();

  // Role is sticky from first sign-up: a patient-only account must never be
  // silently promoted to clinic just by landing on /panel (e.g. via the
  // clinic /login form or a Google OAuth callback, both of which always
  // target /panel regardless of the user's actual role). Instead of a hard
  // redirect, show a confirm gate — the person explicitly opts in to add the
  // clinic role, or bails back to their patient account.
  //
  // Dual-role accounts (both patient AND clinic) are allowed once confirmed
  // here. For now, holding 'clinic' (alone or alongside 'patient') keeps the
  // user in the panel with no further prompt.
  const roles = await getUserRoles(session.user.id);
  if (roles.includes("patient") && !roles.includes("clinic")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <RoleUpgradeGate dict={dict.roleUpgrade} />
      </div>
    );
  }

  // Assign the 'clinic' role on every panel visit — safe because assignRole
  // uses upsert and is idempotent. This covers both email/password and Google
  // OAuth sign-ups without needing a hook, and self-heals after schema resets.
  // Only reached here for users who are not patient-only (see check above).
  await assignRole(session.user.id, "clinic");

  // Email/password sign-ups land here unverified — the panel renders but is
  // blocked by a confirmation overlay until `emailVerified` is true. Google
  // sign-ups arrive pre-verified and skip the gate.
  const needsVerification = session.user.emailVerified === false;

  return (
    <div className="flex min-h-screen flex-col bg-bg md:flex-row">
      <PanelSidebar user={session.user} dict={dict.sidebar} locale={locale} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      {needsVerification && (
        <EmailVerificationGate email={session.user.email} dict={dict.verification} />
      )}
    </div>
  );
}
