"use server";

import { getSession } from "@/lib/auth-session";
import { createClient } from "@/lib/supabase/server";

export type SupportTicketCategory =
  | "billing"
  | "technical"
  | "feature_request"
  | "account"
  | "other";

export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type SupportTicketSource = "panel" | "whatsapp" | "email" | "phone" | "other";
export type SupportCommentAuthorType = "clinic" | "admin";

const VALID_CATEGORIES: SupportTicketCategory[] = ["billing", "technical", "feature_request", "account", "other"];

export interface SupportTicketSummary {
  id: string;
  subject: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  reportedVia: SupportTicketSource;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

export interface SupportTicketComment {
  id: string;
  authorType: SupportCommentAuthorType;
  authorName: string | null;
  authorEmail: string;
  body: string;
  createdAt: string;
}

export interface SupportTicketDetail {
  id: string;
  subject: string;
  description: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  attachments: string[];
  reportedVia: SupportTicketSource;
  createdByAdminEmail: string | null;
  createdAt: string;
  comments: SupportTicketComment[];
}

export type SubmitTicketResult =
  | { ok: true; ticketId: string }
  | { ok: false; error: string };

/** support-ticketing-v1: self-raised from /panel/support — unchanged
 *  behavior from before this feature, just normalized category validation
 *  and reported_via defaulting to 'panel'. */
export async function submitSupportTicket(formData: FormData): Promise<SubmitTicketResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "Sesión no encontrada. Por favor inicia sesión de nuevo." };
  }

  const subject = (formData.get("subject") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const categoryRaw = formData.get("category") as string | null;
  const category: SupportTicketCategory = VALID_CATEGORIES.includes(categoryRaw as SupportTicketCategory)
    ? (categoryRaw as SupportTicketCategory)
    : "other";

  if (!subject || subject.length < 3) {
    return { ok: false, error: "El asunto debe tener al menos 3 caracteres." };
  }
  if (!description || description.length < 10) {
    return { ok: false, error: "La descripción debe tener al menos 10 caracteres." };
  }

  const supabase = await createClient();

  // ── Handle screenshot uploads ──────────────────────────────────────────
  const attachmentUrls: string[] = [];
  const files = formData.getAll("attachments") as File[];
  const validFiles = files.filter((f) => f && f.size > 0 && f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024);

  for (const file of validFiles) {
    const ext = file.name.split(".").pop() ?? "png";
    const fileName = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("support-attachments")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { ok: false, error: `Error al subir imagen: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabase.storage
      .from("support-attachments")
      .getPublicUrl(fileName);

    attachmentUrls.push(publicUrlData.publicUrl);
  }

  // ── Insert ticket ──────────────────────────────────────────────────────
  const { data: ticket, error } = await supabase
    .from("kalendar_support_tickets")
    .insert({
      user_id: session.user.id,
      user_email: session.user.email,
      subject,
      description,
      category,
      attachments: attachmentUrls,
      reported_via: "panel",
    })
    .select("id")
    .single();

  if (error || !ticket) {
    return { ok: false, error: `Error al enviar el ticket: ${error?.message ?? "desconocido"}` };
  }

  return { ok: true, ticketId: ticket.id };
}

/** support-ticketing-v1: the caller's own ticket list for the new
 *  /panel/support history view — ownership-scoped by session, never a
 *  client-passed user id. */
export async function getMyTickets(): Promise<SupportTicketSummary[]> {
  const session = await getSession();
  if (!session?.user?.id) return [];

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("kalendar_support_tickets")
    .select("id, subject, category, status, reported_via, created_at, updated_at")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false });

  const rows = (tickets ?? []) as {
    id: string; subject: string; category: SupportTicketCategory; status: SupportTicketStatus;
    reported_via: SupportTicketSource; created_at: string; updated_at: string;
  }[];
  if (rows.length === 0) return [];

  const { data: comments } = await supabase
    .from("kalendar_support_ticket_comments")
    .select("ticket_id")
    .in("ticket_id", rows.map((r) => r.id));
  const counts = new Map<string, number>();
  for (const c of (comments ?? []) as { ticket_id: string }[]) {
    counts.set(c.ticket_id, (counts.get(c.ticket_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    category: r.category,
    status: r.status,
    reportedVia: r.reported_via,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    commentCount: counts.get(r.id) ?? 0,
  }));
}

/** support-ticketing-v1: full ticket + comment thread — ownership-checked
 *  against the caller's own session, same pattern as every other
 *  clinic-scoped detail fetch in this codebase. */
export async function getTicketWithComments(ticketId: string): Promise<SupportTicketDetail | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("kalendar_support_tickets")
    .select("id, subject, description, category, status, attachments, reported_via, created_by_admin_email, created_at")
    .eq("id", ticketId)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (!ticket) return null;

  const { data: comments } = await supabase
    .from("kalendar_support_ticket_comments")
    .select("id, author_type, author_name, author_email, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  const t = ticket as {
    id: string; subject: string; description: string; category: SupportTicketCategory; status: SupportTicketStatus;
    attachments: string[]; reported_via: SupportTicketSource; created_by_admin_email: string | null; created_at: string;
  };

  return {
    id: t.id,
    subject: t.subject,
    description: t.description,
    category: t.category,
    status: t.status,
    attachments: t.attachments ?? [],
    reportedVia: t.reported_via,
    createdByAdminEmail: t.created_by_admin_email,
    createdAt: t.created_at,
    comments: ((comments ?? []) as {
      id: string; author_type: SupportCommentAuthorType; author_name: string | null; author_email: string; body: string; created_at: string;
    }[]).map((c) => ({
      id: c.id,
      authorType: c.author_type,
      authorName: c.author_name,
      authorEmail: c.author_email,
      body: c.body,
      createdAt: c.created_at,
    })),
  };
}

export type AddCommentResult = { ok: true } | { ok: false; error: string };

/** support-ticketing-v1: clinic reply on their own ticket — ownership
 *  re-checked here too, not just trusted from the UI having shown it. */
export async function addTicketComment(input: { ticketId: string; body: string }): Promise<AddCommentResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "Sesión no encontrada. Por favor inicia sesión de nuevo." };
  }
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Escribe un mensaje." };

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("kalendar_support_tickets")
    .select("id")
    .eq("id", input.ticketId)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (!ticket) return { ok: false, error: "Ticket no encontrado." };

  const { error } = await supabase.from("kalendar_support_ticket_comments").insert({
    ticket_id: input.ticketId,
    author_type: "clinic",
    author_name: session.user.name ?? null,
    author_email: session.user.email,
    body,
  });
  if (error) return { ok: false, error: `No se pudo enviar: ${error.message}` };

  // Bumps updated_at so the ticket surfaces as recently active in both
  // the clinic's own list and the admin list.
  await supabase
    .from("kalendar_support_tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.ticketId);

  return { ok: true };
}
