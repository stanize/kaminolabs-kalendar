import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getBonoTypesForBusiness, getActiveBonoTypesForBusiness, getSoldBonosForBusiness } from "@/lib/bonos/data";
import { getLocale } from "@/lib/i18n/server";
import { getBonosDictionary } from "@/lib/i18n/dictionaries/bonos";
import { BonosManager } from "@/components/panel/bonos-manager";

export default async function BonosPage() {
  const session = await requireSession();

  // clinic-configuration.md's bonos-visibility-toggle — route-guarded, not
  // just hidden from the nav, so a direct URL visit respects the flag too.
  // Doesn't hide/break anything already recorded — a clinic that disables
  // the flag after selling bonos just can't reach this page to sell more,
  // existing bono data (client pages, past-booking payment display) is
  // unaffected elsewhere.
  const business = await getBusinessForUser(session.user.id);
  if (!business?.bonos_enabled) {
    redirect("/panel");
  }

  const locale = await getLocale();
  const dict = getBonosDictionary(locale);

  const [bonoTypes, activeBonoTypes, soldBonos] = await Promise.all([
    getBonoTypesForBusiness(session.user.id),
    getActiveBonoTypesForBusiness(session.user.id),
    getSoldBonosForBusiness(session.user.id),
  ]);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">{dict.page.title}</h1>
        <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
      </div>

      <BonosManager
        initialBonoTypes={bonoTypes}
        activeBonoTypes={activeBonoTypes}
        initialSoldBonos={soldBonos}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}
