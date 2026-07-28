import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getLocale } from "@/lib/i18n/server";
import { getClientPaymentsDictionary } from "@/lib/i18n/dictionaries/client-payments";

/**
 * Payments FROM the clinic's own clients/patients (deposits, no-show
 * charges, per-appointment payment status) — NOT the Kalendar SaaS
 * subscription, which lives at /panel/settings/subscription. Placeholder
 * for now; kalendar_bookings.payment_status already exists in the schema
 * for a future build-out of this page. See MODULES.md.
 */
export default async function ClientPaymentsPage() {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  if (!business) {
    redirect("/panel/business?from=home");
  }

  const locale = await getLocale();
  const dict = getClientPaymentsDictionary(locale);

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6">
        <h1 className="mb-1 text-[24px] text-ink">{dict.page.title}</h1>
        <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold text-ink">{dict.placeholder.title}</h2>
        <p className="mt-2 text-sm text-ink-soft">{dict.placeholder.body}</p>
      </div>
    </div>
  );
}
