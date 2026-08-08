import { redirect } from "next/navigation";
import Link from "next/link";
import { getPatientProfile } from "@/lib/actions/patient";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { PatientProfileForm } from "@/components/patient/patient-profile-form";

export default async function PatientProfilePage() {
  const profile = await getPatientProfile();
  if (!profile) redirect("/patient/login");

  return (
    <div className="min-h-screen bg-surface-2">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-8">
        <Logo size={17} />
        <Link
          href="/patient"
          className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink"
        >
          <Icon name="chevronLeft" size={15} /> Inicio
        </Link>
      </header>

      <div className="mx-auto max-w-[520px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-8">
          <h1 className="mb-1 text-[24px]">Tu perfil</h1>
          <p className="text-[15px] text-ink-soft">
            Estos datos se comparten con las clínicas cuando reservas una cita.
          </p>
        </div>

        <PatientProfileForm
          initialName={profile.name}
          initialContactEmail={profile.contactEmail}
          initialPhone={profile.phone ?? ""}
        />
      </div>
    </div>
  );
}
