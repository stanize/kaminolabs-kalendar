import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { Business } from "@/lib/business/data";
import { buildBusinessSnapshot } from "@/lib/invoices/data";
import { templateBusinessFromSnapshot } from "@/lib/invoices/render";
import { getInvoiceTemplate } from "@/lib/invoices/templates";
import type { InvoiceTemplateProps } from "@/lib/invoices/templates/types";
import { buildVerificationUrl, generateQrDataUri } from "@/lib/invoices/qr";

// invoice-preview (pdf-invoicing.md): a sample invoice built from the
// clinic's CURRENT settings and made-up client/service data, so the clinic
// can see what its invoices look like. Nothing is created or saved and no
// invoice number is consumed. Marked "EJEMPLO" (watermark + number) so it
// can never pass for a real invoice.
const INTL_LOCALE = "es-ES";
const TZ = "Europe/Madrid";

export const PREVIEW_WORD = "EJEMPLO";

export interface PreviewProvider {
  name: string;
  professional_dni: string | null;
  professional_college_number: string | null;
  professional_title: string | null;
  signature_url: string | null;
}

export async function renderInvoicePreviewPdf(business: Business, provider: PreviewProvider | null): Promise<Buffer> {
  const template = getInvoiceTemplate(business.invoice_template_id);
  const snapshot = buildBusinessSnapshot(business, provider);

  // A placeholder URL — the preview invoice does not exist, so the QR
  // points at a made-up id (it will not verify anything).
  const verificationUrl = buildVerificationUrl("ejemplo");
  const qrDataUri = await generateQrDataUri(verificationUrl);

  const props: InvoiceTemplateProps = {
    business: templateBusinessFromSnapshot(snapshot),
    client: { name: "Paciente Ejemplo", dni: "00000000T", address: "Calle Ejemplo 1, 28001 Madrid" },
    invoiceNumberFormatted: PREVIEW_WORD,
    issueDate: new Intl.DateTimeFormat(INTL_LOCALE, { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(
      new Date()
    ),
    serviceName: "Sesión de ejemplo",
    amount: 50,
    paid: true,
    verificationUrl,
    qrDataUri,
    watermark: PREVIEW_WORD,
  };

  const element = createElement(template.component, props) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
