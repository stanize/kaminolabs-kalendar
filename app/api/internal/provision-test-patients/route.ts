import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Internal, secret-gated endpoint used by the admin portal's "create test
 * patients" utility. Creates N real patient accounts through the exact same
 * steps lib/actions/patient.ts's provisionPatient() performs — Better Auth
 * user, 'patient' role row, kalendar_patients profile row — just invoked
 * directly instead of from an authenticated session, since there's no
 * logged-in patient session to call provisionPatient() from here. This is a
 * data-entry shortcut, not a parallel account shape: the resulting rows are
 * indistinguishable from a real patient sign-up.
 *
 * Auth: Bearer DEMO_PROVISION_SECRET, same pattern as the demo-business
 * provisioning endpoint and the cron endpoints.
 */

type TestPatientInput = { name: string; email: string; password: string; phone?: string };

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.DEMO_PROVISION_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let patients: TestPatientInput[];
  try {
    const body = await request.json();
    patients = body.patients;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(patients) || patients.length === 0) {
    return NextResponse.json({ error: "patients must be a non-empty array" }, { status: 400 });
  }
  if (patients.length > 20) {
    return NextResponse.json({ error: "Refusing to create more than 20 patients in one call" }, { status: 400 });
  }

  const supabase = await createClient();
  const results: { email: string; ok: boolean; patientId?: string; error?: string }[] = [];

  for (const p of patients) {
    if (!p.email || !p.password || !p.name) {
      results.push({ email: p.email ?? "(missing)", ok: false, error: "name, email, and password are required" });
      continue;
    }

    try {
      // Reuse an existing user if one already exists for this email (same
      // reasoning as demo-business provisioning: safe because callers are
      // expected to pass emails they've already checked are either fresh
      // or their own prior test-patient run).
      const { data: existingUser } = await supabase
        .from("user")
        .select("id")
        .eq("email", p.email)
        .maybeSingle();

      let userId: string;
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const signUpResult = await auth.api.signUpEmail({
          body: { email: p.email, password: p.password, name: p.name },
        });
        userId = signUpResult.user.id;
      }

      // Test patients skip email verification too — same reasoning as demo
      // clinics: nobody checks that inbox. (The patient portal itself has
      // no emailVerified gate today, but setting this keeps the row
      // consistent with a real, fully-confirmed account regardless.)
      await supabase.from("user").update({ emailVerified: true }).eq("id", userId);

      // Same two steps provisionPatient() performs: role + profile row.
      await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "patient" }, { onConflict: "user_id,role" });

      await supabase
        .from("kalendar_patients")
        .upsert(
          { user_id: userId, name: p.name, phone: p.phone?.trim() || null },
          { onConflict: "user_id" }
        );

      const { data: patientRow } = await supabase
        .from("kalendar_patients")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      results.push({ email: p.email, ok: true, patientId: patientRow?.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ email: p.email, ok: false, error: message });
    }
  }

  return NextResponse.json({ ok: true, results });
}
