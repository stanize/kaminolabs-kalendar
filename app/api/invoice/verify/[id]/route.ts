import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/invoices/data";
import { formatInvoiceNumber } from "@/lib/invoices/types";

/**
 * invoice-qr-verification (spec-invoice-qr.md): the public, no-auth
 * endpoint the invoice PDF's QR points at (via /invoice/verify/[id], the
 * page that calls getInvoiceById itself — this route exists for anyone
 * else who wants to hit it programmatically, same JSON shape).
 *
 * Returns ONLY non-personal fields — scannable by anyone with the QR, so
 * no client name/DNI/address/email, no booking id, nothing from
 * kalendar_clients. Every value comes from the invoice row's own frozen
 * business_snapshot/amount/number — never a live join to kalendar_businesses,
 * consistent with this feature's "frozen at generation" invoice model.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snapshot = invoice.business_snapshot;
  return NextResponse.json({
    invoiceNumber: formatInvoiceNumber(invoice.issue_year, invoice.invoice_number),
    issuedAt: invoice.created_at,
    issuerNif: snapshot.legalId,
    issuerName: snapshot.isSolo ? snapshot.professionalName || snapshot.name : snapshot.name,
    total: invoice.amount,
    currency: "EUR",
    status: "emitida",
  });
}
