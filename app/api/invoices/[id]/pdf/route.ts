import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById, getInvoiceVersionAsRow } from "@/lib/invoices/data";
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

  // invoice-regenerate: `?version=N` renders an older, archived version (the
  // clinic's history links). Without it, always the current version — which
  // is what the patient's emailed link shows.
  let toRender = invoice;
  let suffix = "";
  const versionParam = request.nextUrl.searchParams.get("version");
  if (versionParam) {
    const n = Number(versionParam);
    if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: "Bad version" }, { status: 400 });
    if (n !== invoice.version) {
      const archived = await getInvoiceVersionAsRow(invoice, n);
      if (!archived) return NextResponse.json({ error: "Not found" }, { status: 404 });
      toRender = archived;
      suffix = `-v${n}`;
    }
  }

  const pdfBuffer = await renderInvoicePdf(toRender, true);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="factura-${invoice.invoice_number}${suffix}.pdf"`,
    },
  });
}
