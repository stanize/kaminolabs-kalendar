import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getUserRoles, assignRole } from "@/lib/roles/data";
import { createClient } from "@/lib/supabase/server";
import { PatientRoleGate } from "@/components/auth/patient-role-gate";

export default async function PatientLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/patient/login");

  const userId = session.user.id;

  // A user who arrived here via Google OAuth won't have been provisioned yet
  // (Google redirects straight to /patient bypassing the form's afterAuth()
  // call) — that's a brand-new session with zero roles, so we provision
  // silently, same as before. But if the account already holds a DIFFERENT
  // role (e.g. clinic) and lands here — say, a clinic owner clicking a stray
  // /patient link — don't silently add 'patient' to it. Ask first.
  const roles = await getUserRoles(userId);
  if (!roles.includes("patient")) {
    if (roles.length > 0) {
      return (
        <div className="min-h-screen bg-bg">
          <PatientRoleGate />
        </div>
      );
    }
    // Provision silently — creates the role + kalendar_patients row if missing.
    await assignRole(userId, "patient");
    // Upsert the patient profile row.
    const supabase = await createClient();
    await supabase
      .from("kalendar_patients")
      .upsert({ user_id: userId }, { onConflict: "user_id" });
  }

  return <>{children}</>;
}
