import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getLocale } from "@/lib/i18n/server";
import { getInvoicingDictionary } from "@/lib/i18n/dictionaries/invoicing";
import { getNextInvoiceNumberPreview } from "@/lib/invoices/data";
import { getInvoiceConcepts } from "@/lib/invoices/concepts";
import { InvoicingSettings } from "@/components/panel/invoicing-settings";
import { getTeamForUser } from "@/lib/team/data";

export default async function InvoicingSettingsPage() {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);
  if (!business) redirect("/panel/business?from=home");

  const locale = await getLocale();
  const dict = getInvoicingDictionary(locale);
  const issueYear = new Date().getFullYear();
  const [nextNumberPreview, concepts, team] = await Promise.all([
    getNextInvoiceNumberPreview(business.id, issueYear, business.invoice_next_number),
    getInvoiceConcepts(business.id),
    getTeamForUser(session.user.id),
  ]);
  // invoice-preview: only active members can be "the practitioner" of a
  // sample invoice; the default is the current user (the owner's own row).
  const previewMembers = team.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }));
  const defaultPreviewMemberId = team.find((m) => m.is_owner)?.id ?? previewMembers[0]?.id ?? null;

  return (
    <InvoicingSettings
      initialTemplateId={business.invoice_template_id}
      initialAutoInvoice={business.auto_invoice_enabled}
      initialNextNumberOverride={business.invoice_next_number}
      nextNumberPreview={nextNumberPreview}
      initialConcepts={concepts}
      previewMembers={previewMembers}
      defaultPreviewMemberId={defaultPreviewMemberId}
      dict={dict.settings}
    />
  );
}
