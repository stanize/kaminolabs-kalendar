import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { PatientAuthCard } from "@/components/auth/patient-auth-card";
import { getUserRoles } from "@/lib/roles/data";

export const metadata = { title: "Portal de clientes — Kalendar" };

// A standalone, clinic-independent entry point for the patient portal.
// Previously the only way to reach patient sign-up/sign-in was via a
// specific clinic's booking page (the auth-gate modal in booking-wizard.tsx)
// or the internal /patient/login redirect target — there was no simple,
// shareable URL a patient could go to directly to register or sign in.
// This page is that entry point. /patient/login stays exactly as-is
// (still the unauthenticated-guard redirect target used throughout the
// codebase — proxy.ts, the protected layout, password-reset/email
// redirects) since it's deeply wired into existing flows; this route is
// purely an additional, friendlier front door onto the same auth
// component, same session-conflict handling.
export default async function PatientsPage() {
  // Already authenticated AS A PATIENT — go straight to the portal home.
  // A clinic-only session must still reach this form, signed out first —
  // same role-aware-redirect + signOutFirst pattern as /patient/login (see
  // that page and workflows/clinic-onboarding.md's
  // no-self-service-dual-role-accounts step for the full rationale).
  let hasConflictingSession = false;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      const roles = await getUserRoles(session.user.id);
      if (roles.includes("patient")) redirect("/patient");
      hasConflictingSession = true;
    }
  } catch {
    // No session — show the auth card.
  }

  return (
    <div className="grid min-h-dvh items-start justify-items-center bg-surface-2 px-5 pb-12 pt-16 sm:pt-20">
      <div className="w-full max-w-[420px]">
        <PatientAuthCard redirectTo="/patient" signOutFirst={hasConflictingSession} />
      </div>
    </div>
  );
}
