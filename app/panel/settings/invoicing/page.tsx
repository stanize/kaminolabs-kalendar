import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getLocale } from "@/lib/i18n/server";
import { getInvoicingDictionary } from "@/lib/i18n/dictionaries/invoicing";
import { getNextInvoiceNumberPreview } from "@/lib/invoices/data";
import { InvoicingSettings } from "@/components/panel/invoicing-settings";

export default async function InvoicingSettingsPage() {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);
  if (!business) redirect("/panel/business?from=home");

  const locale = await getLocale();
  const dict = getInvoicingDictionary(locale);
  const issueYear = new Date().getFullYear();
  const nextNumberPreview = await getNextInvoiceNumberPreview(business.id, issueYear, business.invoice_next_number);

  return (
    <InvoicingSettings
      initialTemplateId={business.invoice_template_id}
      initialAutoInvoice={business.auto_invoice_enabled}
      initialSignatureUrl={business.signature_url}
      initialNextNumberOverride={business.invoice_next_number}
      nextNumberPreview={nextNumberPreview}
      dict={dict.settings}
    />
  );
}
