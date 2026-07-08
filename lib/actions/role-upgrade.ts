"use server";

import { requireSession } from "@/lib/auth-session";
import { getUserRoles, assignRole } from "@/lib/roles/data";

/**
 * Checks whether granting the 'clinic' role to the current session's user
 * would be a silent cross-role addition (i.e. holds 'patient' but not
 * 'clinic' yet). Mirrors checkPatientRoleConflict in lib/actions/patient.ts
 * for the opposite direction. Uses the session's own user id — never a
 * client-passed one.
 */
export async function checkClinicRoleConflict(): Promise<{ needsConfirm: boolean }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { needsConfirm: false };
  }
  const roles = await getUserRoles(session.user.id);
  return { needsConfirm: roles.includes("patient") && !roles.includes("clinic") };
}

/**
 * Assigns the 'clinic' role to the current session's user after they've
 * explicitly confirmed the cross-role upgrade prompt in RoleUpgradeGate.
 */
export async function confirmClinicRoleAdd(): Promise<{ ok: true } | { ok: false; error: string }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "No hay sesión activa." };
  }
  await assignRole(session.user.id, "clinic");
  return { ok: true };
}
