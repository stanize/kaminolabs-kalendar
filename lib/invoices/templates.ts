import type { ComponentType } from "react";
import { VatExemptInvoice } from "./templates/vat-exempt";
import type { InvoiceTemplateProps } from "./templates/types";

// invoice-template-selection (pdf-invoicing.md): a string id into this code
// registry, not a FK — templates are React components, not data rows. Only
// one exists so far; adding a second is just adding another entry here.
export const INVOICE_TEMPLATES: Record<string, { label: string; component: ComponentType<InvoiceTemplateProps> }> = {
  "vat-exempt": { label: "Exento de IVA", component: VatExemptInvoice },
};

export const DEFAULT_INVOICE_TEMPLATE_ID = "vat-exempt";

export function getInvoiceTemplate(templateId: string) {
  return INVOICE_TEMPLATES[templateId] ?? INVOICE_TEMPLATES[DEFAULT_INVOICE_TEMPLATE_ID];
}
