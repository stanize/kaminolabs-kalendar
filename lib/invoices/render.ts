import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { InvoiceRow } from "@/lib/invoices/data";
import { getInvoiceTemplate } from "@/lib/invoices/templates";
import type { InvoiceTemplateProps } from "@/lib/invoices/templates/types";
import { formatInvoiceNumber } from "@/lib/invoices/data";

const INTL_LOCALE = "es-ES";
const TZ = "Europe/Madrid";

/**
 * Renders an invoice's PDF live, on request (in-app-pdf-generation,
 * generate-on-request) — entirely from the invoice row's own
 * business-fields-snapshot (frozen at creation time), never the business's
 * CURRENT settings. A later change to the business's name/DNI/address/
 * colegiada number/signature/template must not alter an already-generated
 * invoice. Known trade-off, accepted: if the TEMPLATE COMPONENT's own
 * layout code changes later, re-rendering an old invoice shows the new
 * layout — only the data is frozen, not the rendering code.
 */
export async function renderInvoicePdf(invoice: InvoiceRow, paid: boolean): Promise<Buffer> {
  const snapshot = invoice.business_snapshot;
  const template = getInvoiceTemplate(snapshot.templateId);

  const props: InvoiceTemplateProps = {
    business: {
      name: snapshot.name,
      legalId: snapshot.legalId,
      addressStreet: snapshot.addressStreet,
      addressNumber: snapshot.addressNumber,
      addressAdditional: snapshot.addressAdditional,
      city: snapshot.city,
      addressPostalCode: snapshot.addressPostalCode,
      addressProvince: snapshot.addressProvince,
      addressCountry: snapshot.addressCountry,
      contactEmail: snapshot.contactEmail,
      phoneCountryCode: snapshot.phoneCountryCode,
      phoneNumber: snapshot.phoneNumber,
      professionalDni: snapshot.professionalDni,
      professionalCollegeNumber: snapshot.professionalCollegeNumber,
      signatureUrl: snapshot.signatureUrl,
      brandColor: snapshot.brandColor,
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
