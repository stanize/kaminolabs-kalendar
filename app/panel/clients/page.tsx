import { requireSession } from "@/lib/auth-session";
import { getClientsForBusiness } from "@/lib/clients/data";
import { getLocale } from "@/lib/i18n/server";
import { getClientsDictionary } from "@/lib/i18n/dictionaries/clients";
import { ClientsList } from "@/components/panel/clients-list";

export default async function ClientsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const dict = getClientsDictionary(locale);

  const clients = await getClientsForBusiness(session.user.id);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">{dict.list.title}</h1>
        <p className="text-[15px] text-ink-soft">{dict.list.subtitle}</p>
      </div>

      <ClientsList clients={clients} dict={dict} locale={locale} />
    </div>
  );
}
