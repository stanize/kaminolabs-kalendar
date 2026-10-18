import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getInvoicesForBusiness, getPendingInvoiceBookings } from "@/lib/invoices/data";
import { getLocale } from "@/lib/i18n/server";
import { getInvoicingDictionary } from "@/lib/i18n/dictionaries/invoicing";
import { InvoicesManager } from "@/components/panel/invoices-manager";

export default async function InvoicesPage() {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);
  if (!business) redirect("/panel/business?from=home");

  const [locale, invoices, pendingBookings] = await Promise.all([
    getLocale(),
    getInvoicesForBusiness(business.id),
    getPendingInvoiceBookings(business.id),
  ]);
  const dict = getInvoicingDictionary(locale);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">{dict.page.title}</h1>
        <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
      </div>

      <InvoicesManager invoices={invoices} pendingBookings={pendingBookings} dict={dict.page} confirmModalDict={dict.confirmModal} />
    </div>
  );
}
