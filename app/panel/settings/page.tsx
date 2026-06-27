import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { BusinessSettingsForm } from "@/components/panel/business-settings-form";

export default async function BusinessSettingsPage() {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  const isNew = !business;

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

      <BusinessSettingsForm
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
