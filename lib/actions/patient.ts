"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assignRole, getUserRoles } from "@/lib/roles/data";
import { requireSession } from "@/lib/auth-session";
import { notifyCancellation, notifyCancellationRequested } from "@/lib/actions/booking";

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
 * state and by the booking wizard to link authenticated bookings. name falls
 * back to the Better Auth "user" record when the patient hasn't set a
 * portal-specific override (see kalendar_patients.name). Contact email is
 * intentionally not editable from the portal — patients only edit name and
 * phone; login email (Better Auth) remains the single contact address.
 */
export async function getPatientProfile(): Promise<{
  id: string;
  userId: string;
  phone: string | null;
  name: string;
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
    .select("id, user_id, phone, name")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    phone: data.phone,
    name: data.name ?? session.user.name ?? "",
  };
}

// ── Profile management ──────────────────────────────────────────────────────

export type UpdatePatientProfileResult =
  | { ok: true }
  | { ok: false; error: string };

export interface UpdatePatientProfileDict {
  errNameRequired: string;
  errSaveFailed: string;
}

const PROFILE_FALLBACK: UpdatePatientProfileDict = {
  errNameRequired: "Introduce tu nombre.",
  errSaveFailed: "No se pudo guardar el perfil.",
};

/**
 * Updates the current user's patient-facing profile (name, phone only) —
 * separate from the login account's Better Auth name. Contact email is
 * deliberately not editable here (see getPatientProfile comment). Scoped to
 * the caller's own kalendar_patients row via user_id. The caller must
 * already be a provisioned patient (row created by provisionPatient).
 */
export const updatePatientProfile = async (
  input: { name: string; phone: string },
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

  const phone = input.phone.trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("kalendar_patients")
    .update({
      name,
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
  | { ok: true; requested: boolean } // requested=true means blocked by the
    // cancellation window and submitted as a request instead of cancelled
  | { ok: false; error: string };

export interface CancelPatientBookingDict {
  errNotFound: string;
  errCannotCancel: string;
  errCancelFailed: string;
  errAlreadyRequested: string;
}

const CANCEL_FALLBACK: CancelPatientBookingDict = {
  errNotFound: "Reserva no encontrada.",
  errCannotCancel: "Esta reserva ya no se puede cancelar.",
  errCancelFailed: "No se pudo cancelar la reserva.",
  errAlreadyRequested: "Ya has solicitado cancelar esta reserva.",
};

/**
 * Cancels a booking from the patient portal, or — if the appointment falls
 * inside the clinic's cancellation_window_hours (kalendar_businesses) —
 * submits a cancellation REQUEST instead, which the owner must approve or
 * deny (calendar booking-detail modal). The slot stays held either way
 * while a request is pending (product decision: no other booking can take
 * it until the owner decides). window_hours = 0 means the window is
 * disabled, so self-cancel is always immediate regardless of how close the
 * appointment is — matches pre-window behavior.
 *
 * Scoped to the caller's own patient_id — a patient can only cancel/request
 * on their own bookings, never another patient's or a guest booking.
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
      "id, status, business_id, team_member_id, service_name, starts_at, client_name, client_email, guest_locale, patient_id, cancellation_requested_at"
    )
    .eq("id", bookingId)
    .eq("patient_id", patient.id)
    .maybeSingle();

  if (!booking) return { ok: false, error: t.errNotFound };
  if (!["pending_confirmation", "confirmed"].includes(booking.status)) {
    return { ok: false, error: t.errCannotCancel };
  }
  if (booking.cancellation_requested_at) {
    return { ok: false, error: t.errAlreadyRequested };
  }

  const { data: business } = await supabase
    .from("kalendar_businesses")
    .select("cancellation_window_hours")
    .eq("id", booking.business_id)
    .maybeSingle();

  const windowHours = business?.cancellation_window_hours ?? 24;
  const hoursUntilStart = (new Date(booking.starts_at).getTime() - Date.now()) / (1000 * 60 * 60);
  const insideWindow = windowHours > 0 && hoursUntilStart < windowHours;

  if (insideWindow) {
    const { error } = await supabase
      .from("kalendar_bookings")
      .update({ cancellation_requested_at: new Date().toISOString() })
      .eq("id", bookingId)
      .eq("patient_id", patient.id)
      .in("status", ["pending_confirmation", "confirmed"])
      .is("cancellation_requested_at", null);

    if (error) return { ok: false, error: t.errCancelFailed };

    await notifyCancellationRequested(booking);

    revalidatePath("/patient");
    revalidatePath("/patient/bookings");
    return { ok: true, requested: true };
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
  return { ok: true, requested: false };
};
