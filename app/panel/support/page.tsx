import { Icon } from "@/components/ui/icon";
import { getMyTickets } from "@/lib/actions/support";
import { getLocale } from "@/lib/i18n/server";
import { getSupportDictionary } from "@/lib/i18n/dictionaries/support";
import { SupportManager } from "@/components/panel/support-manager";

// support-ticketing-v1 (workflows/support-ticketing.md): the submit-only
// form is now paired with the clinic's own ticket history/detail/reply
// view, both handled by SupportManager (side-panel pattern, same shell as
// every other add/edit surface in this app) — this page just fetches the
// initial list + dictionary server-side.
export default async function SoportePage() {
  const [tickets, locale] = await Promise.all([getMyTickets(), getLocale()]);
  const dict = getSupportDictionary(locale);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2.5">
            <Icon name="lifeBuoy" size={20} className="text-brand" strokeWidth={1.8} />
            <h1 className="text-[22px] font-bold text-ink">{dict.pageTitle}</h1>
          </div>
          <p className="text-[14px] text-ink-soft">{dict.pageSubtitle}</p>
        </div>
      </div>

      <SupportManager initialTickets={tickets} dict={dict} />
    </div>
  );
}
