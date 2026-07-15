import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { PatientLoginForm } from "@/components/auth/patient-login-form";

export const metadata = { title: "Accede a tu cuenta — Kalendar" };

export default async function PatientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  // Only accept a same-site relative path (starts with a single "/", never
  // "//" which browsers treat as protocol-relative) — anything else falls
  // back to the default portal home. Guards against open-redirect abuse of
  // this query param.
  const params = await searchParams;
  const raw = params.redirectTo;
  const redirectTo = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/patient";

  // If we arrived here from a specific clinic's booking page (redirectTo
  // points at /bookings/[slug], not the generic /patient portal home), show
  // a way back to it — the person may just be browsing, not ready to log in.
  const backToBooking = redirectTo !== "/patient" && redirectTo.startsWith("/bookings/") ? redirectTo : null;

  // Already authenticated — go straight to the target (or the portal home).
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) redirect(redirectTo);
  } catch {
    // No session — show login form.
  }

  return (
    <div className="grid min-h-screen items-start justify-items-center bg-surface-2 px-5 pb-12 pt-16 sm:pt-20">
      <div className="w-full max-w-[420px]">
        {backToBooking && (
          <Link
            href={backToBooking}
            className="mb-4 flex items-center gap-1.5 text-[13.5px] font-medium text-ink-soft hover:text-ink"
          >
            <Icon name="chevronLeft" size={15} />
            Volver a la página de reservas
          </Link>
        )}

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
          <PatientLoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </div>
  );
}
