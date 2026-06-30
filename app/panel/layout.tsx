import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { PanelSidebar } from "@/components/panel/sidebar";
import { EmailVerificationGate } from "@/components/panel/email-verification-gate";
import { getPanelShellServerDictionary } from "@/lib/i18n/server";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { dict } = await getPanelShellServerDictionary();

  // Email/password sign-ups land here unverified — the panel renders but is
  // blocked by a confirmation overlay until `emailVerified` is true. Google
  // sign-ups arrive pre-verified and skip the gate.
  const needsVerification = session.user.emailVerified === false;

  return (
    <div className="flex min-h-screen bg-bg">
      <PanelSidebar user={session.user} dict={dict.sidebar} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      {needsVerification && (
        <EmailVerificationGate email={session.user.email} dict={dict.verification} />
      )}
    </div>
  );
}
