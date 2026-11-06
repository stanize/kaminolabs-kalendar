import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Internal, read-only endpoint for one ticket + its full comment thread.
 * Same secret-gated pattern as the list endpoint (see its doc comment).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_SUPPORT_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: ticket, error } = await supabase
    .from("kalendar_support_tickets")
    .select("id, user_id, user_email, subject, description, category, status, attachments, reported_via, created_by_admin_email, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: business } = await supabase
    .from("kalendar_businesses")
    .select("name")
    .eq("owner_id", ticket.user_id)
    .maybeSingle();

  const { data: comments } = await supabase
    .from("kalendar_support_ticket_comments")
    .select("id, author_type, author_name, author_email, body, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ticket: { ...ticket, business_name: business?.name ?? null },
    comments: comments ?? [],
  });
}
