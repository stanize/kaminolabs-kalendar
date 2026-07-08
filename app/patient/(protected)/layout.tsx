import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { hasRole, assignRole } from "@/lib/roles/data";
import { createClient } from "@/lib/supabase/server";

export default async function PatientLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/patient/login");

  const userId = session.user.id;

  // Check patient role. A user who arrived here via Google OAuth won't have
  // been provisioned yet (Google redirects straight to /patient bypassing the
  // form's afterAuth() call), so we provision on first landing too.
  const isPatient = await hasRole(userId, "patient");
  if (!isPatient) {
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
