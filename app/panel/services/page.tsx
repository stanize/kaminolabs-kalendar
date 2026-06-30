import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getServicesForUser } from "@/lib/services/data";
import { SERVICE_TEMPLATES } from "@/lib/onboarding/data";
import type { BusinessType } from "@/lib/onboarding/types";
import { ServicesManager } from "@/components/panel/services-manager";
import { getLocale } from "@/lib/i18n/server";
import { getServicesDictionary } from "@/lib/i18n/dictionaries/services";

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

  const locale = await getLocale();
  const dict = getServicesDictionary(locale);

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">{dict.page.title}</h1>
        <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
      </div>

      <ServicesManager
        dict={dict}
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
