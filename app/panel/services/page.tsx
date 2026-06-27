import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getServicesForUser } from "@/lib/services/data";
import { SERVICE_TEMPLATES } from "@/lib/onboarding/data";
import type { BusinessType } from "@/lib/onboarding/types";
import { ServicesManager } from "@/components/panel/services-manager";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  // Services depend on a business existing first. If there is none, send the
  // user to the business step (preserving return-intent).
  if (!business) {
    redirect("/panel/business?from=home");
  }

  const services = await getServicesForUser(session.user.id);

  const { from } = await searchParams;
  const returnToHome = from === "home";

  // Starter templates for this business type, as [name, duration_min, price].
  const templates = SERVICE_TEMPLATES[business.type as BusinessType] ?? [];

  return (
    <div className="mx-auto max-w-[680px] px-8 py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">Tus servicios</h1>
        <p className="text-[15px] text-ink-soft">
          Define lo que tus clientes podrán reservar contigo.
        </p>
      </div>

      <ServicesManager
        initialServices={services.map((s) => ({
          id: s.id,
          name: s.name,
          duration_min: s.duration_min,
          price: s.price,
        }))}
        templates={templates.map(([name, duration_min, price]) => ({
          name,
          duration_min,
          price,
        }))}
        returnToHome={returnToHome}
      />
    </div>
  );
}
