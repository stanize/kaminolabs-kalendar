import { requireSession } from "@/lib/auth-session";
import { getSetupProgress } from "@/lib/business/data";
import { BusinessForm } from "@/components/panel/business-form";

export default async function BusinessPage() {
  const session = await requireSession();
  const { business, hasServices, hasActiveHours, hasTeam } = await getSetupProgress(
    session.user.id
  );

  const isNew = !business;

  // Setup is complete once a business exists and the other three blocks have
  // rows. The form uses this to decide whether to return to Inicio after save
  // (incomplete setup) or stay put (everything already done).
  const setupComplete = !!business && hasServices && hasActiveHours && hasTeam;

  return (
    <div className="mx-auto max-w-[680px] px-8 py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">Configura tu negocio</h1>
        <p className="text-[15px] text-ink-soft">
          {isNew
            ? "Cuéntanos de tu negocio. Así te verán tus clientes al reservar."
            : "Edita los datos de tu negocio."}
        </p>
      </div>

      <BusinessForm
        setupComplete={setupComplete}
        initial={
          business
            ? {
                name: business.name,
                type: business.type,
                city: business.city ?? "",
                slug: business.slug,
                slugStatus: business.slug_status,
              }
            : null
        }
      />
    </div>
  );
}
