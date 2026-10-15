// Client-safe shared types/helpers for invoices — split out from
// lib/invoices/data.ts (which imports "server-only") so client components
// like invoices-manager.tsx can use the InvoiceRow shape and
// formatInvoiceNumber without pulling in server-only code.
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
}

/** "2026-0001" — the display/content format, per sequential-numbering-allocation. */
export function formatInvoiceNumber(issueYear: number, invoiceNumber: string): string {
  return `${issueYear}-${invoiceNumber}`;
}
