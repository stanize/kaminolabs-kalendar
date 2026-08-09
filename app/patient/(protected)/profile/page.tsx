import { redirect } from "next/navigation";
import { getPatientProfile } from "@/lib/actions/patient";
import { PatientProfileForm } from "@/components/patient/patient-profile-form";
import { PatientHeader } from "@/components/patient/patient-header";

export default async function PatientProfilePage() {
  const profile = await getPatientProfile();
  if (!profile) redirect("/patient/login");

  return (
    <div className="min-h-screen bg-surface-2">
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
      </div>
    </div>
  );
}
