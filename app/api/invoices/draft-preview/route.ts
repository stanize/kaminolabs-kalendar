import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { createClient } from "@/lib/supabase/server";
import { getProviderForBooking } from "@/lib/invoices/data";
import { renderInvoiceDraftPdf } from "@/lib/invoices/preview";

// invoice-edit-before-generate (pdf-invoicing.md): a live "BORRADOR" PDF of
// the invoice about to be generated, built from the appointment plus the
// fields the clinic has edited so far. Authenticated by session; the booking
// must belong to the caller's own business. Creates, saves and numbers
// nothing.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const business = await getBusinessForUser(session.user.id);
  if (!business) return NextResponse.json({ error: "No business" }, { status: 404 });

  let body: {
    bookingId?: string;
    clientName?: string;
    clientDni?: string;
    clientAddress?: string;
    extraConcept?: string;
    note?: string;
    amount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("kalendar_bookings")
    .select("id, team_member_id, client_name, service_name, service_price")
    .eq("id", body.bookingId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const provider = await getProviderForBooking(business.id, booking.team_member_id);

  const amount = typeof body.amount === "number" && Number.isFinite(body.amount) ? body.amount : Number(booking.service_price);
  const extra = (body.extraConcept ?? "").trim().slice(0, 200);
  const pdf = await renderInvoiceDraftPdf(business, provider, {
    clientName: (body.clientName ?? "").trim().slice(0, 120) || booking.client_name,
    clientDni: (body.clientDni ?? "").trim().slice(0, 40),
    clientAddress: (body.clientAddress ?? "").trim().slice(0, 200),
    serviceName: extra ? `${booking.service_name}\n${extra}` : booking.service_name,
    amount,
    note: (body.note ?? "").trim().slice(0, 300) || null,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
  });
}
