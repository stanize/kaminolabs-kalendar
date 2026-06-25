"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type SupportTicketCategory =
  | "billing"
  | "technical"
  | "feature_request"
  | "account"
  | "other";

export type SubmitTicketResult =
  | { ok: true; ticketId: string }
  | { ok: false; error: string };

export async function submitSupportTicket(formData: FormData): Promise<SubmitTicketResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { ok: false, error: "Sesión no encontrada. Por favor inicia sesión de nuevo." };
  }

  const subject = (formData.get("subject") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const category = (formData.get("category") as SupportTicketCategory | null) ?? "other";

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
  const validFiles = files.filter((f) => f && f.size > 0);

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
    })
    .select("id")
    .single();

  if (error || !ticket) {
    return { ok: false, error: `Error al enviar el ticket: ${error?.message ?? "desconocido"}` };
  }

  return { ok: true, ticketId: ticket.id };
}
