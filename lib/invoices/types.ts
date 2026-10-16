// Client-safe shared types/helpers for invoices — split out from
// lib/invoices/data.ts (which imports "server-only") so client components
// like invoices-manager.tsx can use the InvoiceRow shape and
// formatInvoiceNumber without pulling in server-only code.

/**
 * business-fields-snapshot (pdf-invoicing.md, 2026-10): every business-level
 * field the PDF template renders, frozen onto the invoice row at creation
 * time. A later change to the business's name/DNI/address/colegiada
 * number/signature/template must NOT alter an already-generated invoice —
 * only service_name/amount/client fields were ever snapshotted before this;
 * this closes that gap for the business side too.
 */
export interface InvoiceBusinessSnapshot {
  name: string;
  legalId: string | null;
  addressStreet: string;
  addressNumber: string;
  addressAdditional: string | null;
  city: string;
  addressPostalCode: string;
  addressProvince: string;
  addressCountry: string;
  contactEmail: string;
  phoneCountryCode: string;
  phoneNumber: string;
  professionalDni: string | null;
  professionalCollegeNumber: string | null;
  professionalName: string | null;
  signatureUrl: string | null;
  templateId: string;
  brandColor: string;
  // solo-provider-header (2026-10): when the business is solo mode, the
  // invoice header shows just the provider's name + DNI/colegiada instead
  // of the clinic name/address — multi-provider header handling is
  // deferred for later.
  isSolo: boolean;
}

export interface InvoiceRow {
  id: string;
  business_id: string;
  booking_id: string | null;
  invoice_number: string;
  issue_year: number;
  client_name: string;
  client_email: string;
  service_name: string;
  payment_method: "cash" | "card" | "bono" | null;
  amount: number;
  access_token: string;
  sent_at: string | null;
  created_at: string;
  business_snapshot: InvoiceBusinessSnapshot;
}

/** "2026-0001" — the display/content format, per sequential-numbering-allocation. */
export function formatInvoiceNumber(issueYear: number, invoiceNumber: string): string {
  return `${issueYear}-${invoiceNumber}`;
}
