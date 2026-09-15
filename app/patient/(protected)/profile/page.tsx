import { redirect } from "next/navigation";
import Link from "next/link";
import { getPatientProfile } from "@/lib/actions/patient";
import { PatientProfileForm } from "@/components/patient/patient-profile-form";
import { PatientHeader } from "@/components/patient/patient-header";

export default async function PatientProfilePage() {
  const profile = await getPatientProfile();
  if (!profile) redirect("/patient/login");

  return (
    <div className="min-h-dvh bg-surface-2">
      <PatientHeader current="profile" />

      <div className="mx-auto max-w-[520px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-8">
          <h1 className="mb-1 text-[24px]">Tu perfil</h1>
          <p className="text-[15px] text-ink-soft">
            Estos datos se comparten con las clínicas cuando reservas una cita.
          </p>
        </div>

        <PatientProfileForm
          initialName={profile.name}
          initialPhone={profile.phone ?? ""}
        />

        {/* Legal (2026-09) — returnTo brings you back here rather than to
            legal-page.tsx's "/" default. Plain in-page nav, not a new tab:
            unlike sign-up, there's no in-progress form here to protect. */}
        <div className="mt-8 border-t border-line pt-6">
          <h2 className="mb-2 text-[13px] font-semibold text-ink">Legal</h2>
          <div className="flex flex-col gap-1.5">
            <Link href="/legal/privacy?returnTo=%2Fpatient%2Fprofile" className="text-[13.5px] text-brand underline hover:text-brand-ink">
              Política de privacidad
            </Link>
            <Link href="/legal/terms?returnTo=%2Fpatient%2Fprofile" className="text-[13.5px] text-brand underline hover:text-brand-ink">
              Términos de servicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
