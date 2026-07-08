import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { PatientLoginForm } from "@/components/auth/patient-login-form";

export const metadata = { title: "Accede a tu cuenta — Kalendar" };

export default async function PatientLoginPage() {
  // Already authenticated — go straight to the patient portal.
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) redirect("/patient");
  } catch {
    // No session — show login form.
  }

  return (
    <div className="grid min-h-screen items-start justify-items-center bg-surface-2 px-5 pb-12 pt-16 sm:pt-20">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={22} />
          <div>
            <h1 className="text-[24px]">Accede a tu cuenta</h1>
            <p className="mt-1 text-[15px] text-ink-soft">
              Gestiona tus reservas y citas
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <PatientLoginForm redirectTo="/patient" />
        </div>
      </div>
    </div>
  );
}
