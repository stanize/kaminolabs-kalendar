import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { Business } from "@/lib/business/data";
import type { InvoiceRow } from "@/lib/invoices/data";
import { getInvoiceTemplate } from "@/lib/invoices/templates";
import type { InvoiceTemplateProps } from "@/lib/invoices/templates/types";
import { formatInvoiceNumber } from "@/lib/invoices/data";

const INTL_LOCALE = "es-ES";
const TZ = "Europe/Madrid";

/**
 * Renders an invoice's PDF live, on request (in-app-pdf-generation,
 * generate-on-request) — from the invoice row's own already-snapshotted
 * fields plus the business's CURRENT settings (template, DNI, colegiada,
 * signature). Known trade-off, accepted: if the template's layout changes
 * later, re-rendering an old invoice shows the new layout, not whatever it
 * looked like when sent — the numbers/content stay accurate regardless,
 * since they're snapshotted on the row.
 */
export async function renderInvoicePdf(invoice: InvoiceRow, business: Business, paid: boolean): Promise<Buffer> {
  const template = getInvoiceTemplate(business.invoice_template_id);

  const props: InvoiceTemplateProps = {
    business: {
      name: business.name,
      legalId: business.legal_id,
      addressStreet: business.address_street,
      addressNumber: business.address_number,
      addressAdditional: business.address_additional,
      city: business.city,
      addressPostalCode: business.address_postal_code,
      addressProvince: business.address_province,
      addressCountry: business.address_country,
      contactEmail: business.contact_email,
      phoneCountryCode: business.phone_country_code,
      phoneNumber: business.phone_number,
      professionalDni: business.professional_dni,
      professionalCollegeNumber: business.professional_college_number,
      signatureUrl: business.signature_url,
    },
    client: { name: invoice.client_name },
    invoiceNumberFormatted: formatInvoiceNumber(invoice.issue_year, invoice.invoice_number),
    issueDate: new Intl.DateTimeFormat(INTL_LOCALE, { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(
      new Date(invoice.created_at)
    ),
    serviceName: invoice.service_name,
    amount: invoice.amount,
    paid,
  };

  // Our template components render a <Document> internally, but TS only
  // sees the custom component's own prop type — safe to assert here since
  // every entry in INVOICE_TEMPLATES is required to render one.
  const element = createElement(template.component, props) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
