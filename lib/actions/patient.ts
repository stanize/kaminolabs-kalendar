"use server";

import { createClient } from "@/lib/supabase/server";
import { assignRole } from "@/lib/roles/data";
import { requireSession } from "@/lib/auth-session";

export type ProvisionResult =
  | { ok: true; patientId: string }
  | { ok: false; error: string };

/**
 * Provisions a patient account for the currently authenticated user.
 * Safe to call multiple times — both the role upsert and patient row insert
 * are idempotent. Called:
 *   • After sign-up or sign-in via /patient/login
 *   • After sign-up or sign-in via the booking page auth gate
 */
export async function provisionPatient(phone?: string): Promise<ProvisionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "No hay sesión activa." };
  }

  const userId = session.user.id;

  // 1. Assign the patient role (idempotent upsert).
  await assignRole(userId, "patient");

  // 2. Upsert the kalendar_patients row. The user may already have a patient
  //    profile from a previous sign-up attempt — using upsert ensures we never
  //    create duplicates and we can update the phone if provided.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kalendar_patients")
    .upsert(
      {
        user_id: userId,
        ...(phone ? { phone: phone.trim() || null } : {}),
      },
      { onConflict: "user_id" }
    )
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "No se pudo crear el perfil de paciente." };
  }

  return { ok: true, patientId: data.id };
}

/**
 * Returns the current user's patient profile, or null if they are not yet
 * provisioned as a patient. Used by the patient portal to check registration
 * state and by the booking wizard to link authenticated bookings.
 */
export async function getPatientProfile(): Promise<{
  id: string;
  userId: string;
  phone: string | null;
} | null> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return null;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_patients")
    .select("id, user_id, phone")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, userId: data.user_id, phone: data.phone };
}
