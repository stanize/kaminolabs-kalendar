import { NextRequest, NextResponse } from "next/server";
import { getBusinessById } from "@/lib/business/data";
import { getInvoiceById } from "@/lib/invoices/data";
import { renderInvoicePdf } from "@/lib/invoices/render";

// in-app-pdf-generation (pdf-invoicing.md): generate-on-request, no stored
// file. One route used by both the owner's Facturas-page download link and
// the client's emailed link — access_token alone grants access, no login
// (kalendar-invoices-schema's access_token, same bearer-token model as
// kalendar_bookings.confirm_token). Works even if the email is forwarded,
// by explicit design.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const invoice = await getInvoiceById(id);
  if (!invoice || invoice.access_token !== token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const business = await getBusinessById(invoice.business_id);
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdfBuffer = await renderInvoicePdf(invoice, business, true);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="factura-${invoice.invoice_number}.pdf"`,
    },
  });
}
