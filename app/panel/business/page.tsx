import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { BusinessForm } from "@/components/panel/business-form";
import { getLocale } from "@/lib/i18n/server";
import { getBusinessDictionary } from "@/lib/i18n/dictionaries/business";

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

  const locale = await getLocale();
  const dict = getBusinessDictionary(locale);

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">{dict.page.titleNew}</h1>
        <p className="text-[15px] text-ink-soft">
          {isNew ? dict.page.subtitleNew : dict.page.subtitleEdit}
        </p>
      </div>

      <BusinessForm
        dict={dict}
        locale={locale}
        returnToHome={returnToHome}
        userEmail={session.user.email}
        initial={
          business
            ? {
                name: business.name,
                type: business.type,
                city: business.city,
                legalId: business.legal_id ?? "",
                addressStreet: business.address_street,
                addressNumber: business.address_number,
                addressAdditional: business.address_additional ?? "",
                addressPostalCode: business.address_postal_code,
                addressProvince: business.address_province,
                phone: business.phone,
                contactEmail: business.contact_email,
                slug: business.slug,
                slugStatus: business.slug_status,
              }
            : null
        }
      />
    </div>
  );
}
