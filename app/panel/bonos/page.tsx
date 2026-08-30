import { requireSession } from "@/lib/auth-session";
import { getBonoTypesForBusiness, getActiveBonoTypesForBusiness, getSoldBonosForBusiness } from "@/lib/bonos/data";
import { getLocale } from "@/lib/i18n/server";
import { getBonosDictionary } from "@/lib/i18n/dictionaries/bonos";
import { BonosManager } from "@/components/panel/bonos-manager";

export default async function BonosPage() {
  const session = await requireSession();
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
