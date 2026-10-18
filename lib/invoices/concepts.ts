import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * invoice-concepts-list (pdf-invoicing.md): a per-business, clinic-managed
 * list of billing line-item descriptions, picked (or typed fresh) at
 * invoice-generation time instead of always reusing the booking's
 * service_name verbatim. Blank slate by design — no starter list is seeded
 * for any business.
 */
export interface InvoiceConcept {
  id: string;
  label: string;
}

export async function getInvoiceConcepts(businessId: string): Promise<InvoiceConcept[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_invoice_concepts")
    .select("id, label")
    .eq("business_id", businessId)
    .order("label", { ascending: true });
  return (data as InvoiceConcept[] | null) ?? [];
}

/**
 * Case-insensitive lookup-or-insert, shared by the explicit "add" action in
 * Settings and the invoice confirm modal's auto-add-on-custom-entry
 * behavior (typing a concept that isn't in the list yet adds it here too).
 */
export async function findOrCreateInvoiceConcept(businessId: string, label: string): Promise<InvoiceConcept | null> {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("kalendar_invoice_concepts")
    .select("id, label")
    .eq("business_id", businessId)
    .ilike("label", trimmed)
    .maybeSingle();
  if (existing) return existing as InvoiceConcept;

  const { data: created } = await supabase
    .from("kalendar_invoice_concepts")
    .insert({ business_id: businessId, label: trimmed })
    .select("id, label")
    .single();
  return (created as InvoiceConcept | null) ?? null;
}

export async function renameInvoiceConcept(businessId: string, conceptId: string, label: string): Promise<InvoiceConcept | null> {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data: updated } = await supabase
    .from("kalendar_invoice_concepts")
    .update({ label: trimmed })
    .eq("id", conceptId)
    .eq("business_id", businessId)
    .select("id, label")
    .maybeSingle();
  return (updated as InvoiceConcept | null) ?? null;
}

export async function deleteInvoiceConcept(businessId: string, conceptId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("kalendar_invoice_concepts")
    .delete()
    .eq("id", conceptId)
    .eq("business_id", businessId);
  return !error;
}
