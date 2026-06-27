import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { BusinessForm } from "@/components/panel/business-form";

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  const { from } = await searchParams;
  // Return-intent: links from the home page carry ?from=home. After a successful
  // primary save, the form sends the user back to Inicio. Direct nav from the
  // sidebar has no param, so the user stays put to keep editing.
  const returnToHome = from === "home";

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

      <BusinessForm
        returnToHome={returnToHome}
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
