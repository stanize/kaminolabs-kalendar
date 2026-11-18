import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { createClient } from "@/lib/supabase/server";
import { renderInvoicePreviewPdf, type PreviewProvider } from "@/lib/invoices/preview";

// invoice-preview (pdf-invoicing.md): a sample invoice PDF for the signed-in
// clinic, with made-up client/service data. ?member=<team member id> picks
// whose title/colegiada/signature are shown; without it, the owner's own
// team-member row (the current user). Authenticated by session, like every
// other panel action — never reachable without a login, and the member must
// belong to the caller's own business.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const business = await getBusinessForUser(session.user.id);
  if (!business) return NextResponse.json({ error: "No business" }, { status: 404 });

  const memberId = request.nextUrl.searchParams.get("member");
  const supabase = await createClient();
  const columns = "name, professional_dni, professional_college_number, professional_title, signature_url";

  let provider: PreviewProvider | null = null;
  if (memberId) {
    const { data } = await supabase
      .from("kalendar_team_members")
      .select(columns)
      .eq("id", memberId)
      .eq("business_id", business.id)
      .maybeSingle();
    provider = (data as PreviewProvider | null) ?? null;
  }
  if (!provider) {
    const { data } = await supabase
      .from("kalendar_team_members")
      .select(columns)
      .eq("business_id", business.id)
      .eq("is_owner", true)
      .maybeSingle();
    provider = (data as PreviewProvider | null) ?? null;
  }

  const pdf = await renderInvoicePreviewPdf(business, provider);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="factura-ejemplo.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
