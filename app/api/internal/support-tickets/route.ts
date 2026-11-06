import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Internal, read-only endpoint listing support tickets across every
 * business. Same secret-gated pattern as /api/internal/schema and
 * /api/internal/migrations (see those files' doc comments) — lets a
 * Claude session or the admin portal pull ticket context without
 * needing live DB credentials. Read-only: no write capability here.
 * See workflows/support-ticketing.md.
 *
 * Optional query params: ?status=open|in_progress|resolved|closed,
 * ?limit=N (default 100, max 500).
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_SUPPORT_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

  const supabase = await createClient();
  let query = supabase
    .from("kalendar_support_tickets")
    .select("id, user_id, user_email, subject, description, category, status, attachments, reported_via, created_by_admin_email, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);

  const { data: tickets, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((tickets ?? []).map((t) => t.user_id as string))];
  const { data: businesses } = userIds.length > 0
    ? await supabase.from("kalendar_businesses").select("owner_id, name").in("owner_id", userIds)
    : { data: [] as { owner_id: string; name: string }[] };
  const businessNameByUser = new Map((businesses ?? []).map((b: { owner_id: string; name: string }) => [b.owner_id, b.name]));

  const result = (tickets ?? []).map((t) => ({
    ...t,
    business_name: businessNameByUser.get(t.user_id as string) ?? null,
  }));

  return NextResponse.json({ tickets: result });
}
