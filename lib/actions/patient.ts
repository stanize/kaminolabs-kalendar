"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assignRole, getUserRoles } from "@/lib/roles/data";
import { requireSession } from "@/lib/auth-session";
import { notifyCancellation } from "@/lib/actions/booking";

export type ProvisionResult =
  | { ok: true; patientId: string }
  | { ok: false; error: string };

/**
 * Checks whether granting the 'patient' role to the current session's user
 * would be a silent cross-role addition (i.e. the account already holds a
 * DIFFERENT role, such as 'clinic', and does not yet hold 'patient'). Callers
 * should show a confirmation prompt before calling provisionPatient() when
 * this returns true — brand-new accounts (no roles yet) never need to ask.
 */
export async function checkPatientRoleConflict(): Promise<{ needsConfirm: boolean }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { needsConfirm: false };
  }
  const roles = await getUserRoles(session.user.id);
  return { needsConfirm: roles.length > 0 && !roles.includes("patient") };
}

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

  const supabase = await createClient();

  // 2. Try to insert the patient row. Ignore conflict errors (user already
  //    has a profile from a previous sign-up). We always fetch separately
  //    in step 3 so it doesn't matter whether this was a new insert or not.
  await supabase
    .from("kalendar_patients")
    .insert({ user_id: userId, ...(phone ? { phone: phone.trim() || null } : {}) })
    .select("id")
    .maybeSingle();

  // 3. Fetch the row — works whether we just inserted or it already existed.
  const { data, error: fetchError } = await supabase
    .from("kalendar_patients")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("[provisionPatient] fetch error:", fetchError.message, fetchError.code);
    return { ok: false, error: `No se pudo obtener el perfil. (${fetchError.message})` };
  }

  if (!data) {
    console.error("[provisionPatient] no row found for userId:", userId);
    return { ok: false, error: "No se pudo crear el perfil de cliente." };
  }

  return { ok: true, patientId: data.id };
}

/**
 * Returns the current user's patient profile, or null if they are not yet
 * provisioned as a patient. Used by the patient portal to check registration
 * state and by the booking wizard to link authenticated bookings. name/email
 * fall back to the Better Auth "user" record when the patient hasn't set a
 * portal-specific override (see kalendar_patients.name/contact_email).
 */
export async function getPatientProfile(): Promise<{
  id: string;
  userId: string;
  phone: string | null;
  name: string;
  contactEmail: string;
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
    .select("id, user_id, phone, name, contact_email")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    phone: data.phone,
    name: data.name ?? session.user.name ?? "",
    contactEmail: data.contact_email ?? session.user.email ?? "",
  };
}

// ── Profile management ──────────────────────────────────────────────────────

export type UpdatePatientProfileResult =
  | { ok: true }
  | { ok: false; error: string };

export interface UpdatePatientProfileDict {
  errNameRequired: string;
  errEmailInvalid: string;
  errSaveFailed: string;
}

const PROFILE_FALLBACK: UpdatePatientProfileDict = {
  errNameRequired: "Introduce tu nombre.",
  errEmailInvalid: "Introduce un email válido.",
  errSaveFailed: "No se pudo guardar el perfil.",
};

/**
 * Updates the current user's patient-facing profile (name, contact email,
 * phone) — all separate from the login account's Better Auth name/email.
 * Scoped to the caller's own kalendar_patients row via user_id. The caller
 * must already be a provisioned patient (row created by provisionPatient).
 */
export const updatePatientProfile = async (
  input: { name: string; contactEmail: string; phone: string },
  dict?: Partial<UpdatePatientProfileDict>
): Promise<UpdatePatientProfileResult> => {
  const t = { ...PROFILE_FALLBACK, ...dict };

  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: t.errSaveFailed };
  }

  const name = input.name.trim();
  if (name.length < 1) return { ok: false, error: t.errNameRequired };

  const contactEmail = input.contactEmail.trim();
  if (!contactEmail.includes("@")) return { ok: false, error: t.errEmailInvalid };

  const phone = input.phone.trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("kalendar_patients")
    .update({
      name,
      contact_email: contactEmail,
      phone: phone || null,
    })
    .eq("user_id", session.user.id);

  if (error) return { ok: false, error: t.errSaveFailed };

  revalidatePath("/patient");
  revalidatePath("/patient/profile");
  return { ok: true };
};

// ── Self-service cancel ─────────────────────────────────────────────────────

export type CancelPatientBookingResult =
  | { ok: true }
  | { ok: false; error: string };

export interface CancelPatientBookingDict {
  errNotFound: string;
  errCannotCancel: string;
  errCancelFailed: string;
}

const CANCEL_FALLBACK: CancelPatientBookingDict = {
  errNotFound: "Reserva no encontrada.",
  errCannotCancel: "Esta reserva ya no se puede cancelar.",
  errCancelFailed: "No se pudo cancelar la reserva.",
};

/**
 * Cancels a booking from the patient portal. Scoped to the caller's own
 * patient_id — a patient can only cancel their own bookings, never another
 * patient's or a guest booking. Same effect as the emailed cancel-token link
 * (frees the slot, notifies the clinic) — this is just a second entry point
 * for a patient who's already signed in and doesn't need the email link.
 */
export const cancelBookingAsPatient = async (
  bookingId: string,
  dict?: Partial<CancelPatientBookingDict>
): Promise<CancelPatientBookingResult> => {
  const t = { ...CANCEL_FALLBACK, ...dict };

  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: t.errNotFound };
  }

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("kalendar_patients")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!patient) return { ok: false, error: t.errNotFound };

  const { data: booking } = await supabase
    .from("kalendar_bookings")
    .select(
      "id, status, business_id, team_member_id, service_name, starts_at, client_name, client_email, guest_locale, patient_id"
    )
    .eq("id", bookingId)
    .eq("patient_id", patient.id)
    .maybeSingle();

  if (!booking) return { ok: false, error: t.errNotFound };
  if (!["pending_confirmation", "confirmed"].includes(booking.status)) {
    return { ok: false, error: t.errCannotCancel };
  }

  const { error } = await supabase
    .from("kalendar_bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("patient_id", patient.id)
    .in("status", ["pending_confirmation", "confirmed"]);

  if (error) return { ok: false, error: t.errCancelFailed };

  // Notify the clinic (and send the patient their own cancellation receipt) —
  // same shared helper the token-based and owner-initiated cancel paths use.
  await notifyCancellation(booking, false);

  revalidatePath("/patient");
  revalidatePath("/patient/bookings");
  return { ok: true };
};
