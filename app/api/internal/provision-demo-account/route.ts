import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSlug, suggestSlug, screenSlug } from "@/lib/business/slug-screen";
import { BUSINESS_TYPES } from "@/lib/onboarding/data";
import type { BusinessType } from "@/lib/onboarding/types";

/**
 * Internal, secret-gated endpoint used ONLY by the admin portal's
 * "create demo account" tool (workflows/presales-demo-onboarding.md,
 * demo-account-creation step). Creates a real Better Auth user (dummy email
 * Arun controls) plus a fully-populated business — same tables, same shapes,
 * same defaults as a clinic going through the normal wizard by hand. This
 * is a data-entry shortcut, NOT a parallel creation path: it does not
 * introduce any state or table a manual signup couldn't also reach.
 *
 * Auth: Bearer DEMO_PROVISION_SECRET, same pattern as the cron endpoints.
 */

type DemoServiceInput = { name: string; duration_min: number; price: number };

type DemoProvisionInput = {
  email: string;
  password: string;
  ownerName: string;
  business: {
    name: string;
    type: string;
    addressStreet: string;
    addressNumber: string;
    addressAdditional?: string | null;
    city: string;
    addressPostalCode: string;
    addressProvince: string;
    addressCountry?: string;
    phoneCountryCode?: string;
    phoneNumber: string;
    contactEmail: string;
  };
  services: DemoServiceInput[];
  sourceUrl?: string;
};

const VALID_TYPES = new Set<string>(BUSINESS_TYPES.map((t) => t.id));
function isValidType(value: string): value is BusinessType {
  return VALID_TYPES.has(value);
}

// Default clinic hours pre-filled by the wizard for a new business: Mon-Fri
// 09:00-17:00, weekend closed. Mirrors availability-manager.tsx's default.
const DEFAULT_HOURS: { day: string; start: string; end: string }[] = [
  "mon", "tue", "wed", "thu", "fri",
].map((day) => ({ day, start: "09:00", end: "17:00" }));

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.DEMO_PROVISION_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: DemoProvisionInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!input.email || !input.password || !input.business?.name) {
    return NextResponse.json(
      { error: "email, password, and business.name are required" },
      { status: 400 }
    );
  }
  if (!isValidType(input.business.type)) {
    return NextResponse.json(
      { error: `Invalid business.type. Must be one of: ${[...VALID_TYPES].join(", ")}` },
      { status: 400 }
    );
  }

  // 1) Create the Better Auth user. requireEmailVerification is false
  //    project-wide, so this account is immediately usable — no
  //    verification-gate bypass needed, same as any real email/password
  //    sign-up.
  let userId: string;
  try {
    const signUpResult = await auth.api.signUpEmail({
      body: { email: input.email, password: input.password, name: input.ownerName },
    });
    userId = signUpResult.user.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-up failed";
    return NextResponse.json({ error: `Could not create user: ${message}` }, { status: 400 });
  }

  const supabase = await createClient();

  // 2) Business row — same slug logic as saveBusinessSettings's CREATE path.
  const baseSlug = sanitizeSlug(suggestSlug(input.business.name));
  let slug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabase
      .from("kalendar_businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
  }
  const screen = screenSlug(slug);

  const { data: business, error: bizError } = await supabase
    .from("kalendar_businesses")
    .insert({
      owner_id: userId,
      name: input.business.name,
      type: input.business.type,
      address_street: input.business.addressStreet,
      address_number: input.business.addressNumber,
      address_additional: input.business.addressAdditional || null,
      city: input.business.city,
      address_postal_code: input.business.addressPostalCode,
      address_province: input.business.addressProvince,
      address_country: input.business.addressCountry || "España",
      phone_country_code: input.business.phoneCountryCode || "+34",
      phone_number: input.business.phoneNumber,
      contact_email: input.business.contactEmail,
      slug,
      slug_status: screen.clean ? "active" : "pending_review",
      slug_flag_reason: screen.clean ? null : screen.reason,
      is_demo: true,
      demo_created_at: new Date().toISOString(),
      demo_source_url: input.sourceUrl || null,
    })
    .select("id, slug")
    .single();

  if (bizError || !business) {
    return NextResponse.json(
      { error: `Could not create business: ${bizError?.message}` },
      { status: 500 }
    );
  }

  // 3) Owner as team member (solo mode — same as ensureOwnerSeeded).
  await supabase.from("kalendar_team_members").insert({
    business_id: business.id,
    name: input.ownerName,
    is_owner: true,
    sort_order: 0,
  });

  // 4) Services.
  if (input.services.length > 0) {
    const rows = input.services.map((s, i) => ({
      business_id: business.id,
      name: s.name,
      duration_min: s.duration_min,
      price: s.price,
      sort_order: i,
    }));
    const { error: svcError } = await supabase.from("kalendar_services").insert(rows);
    if (svcError) {
      return NextResponse.json(
        { error: `Business created but services failed: ${svcError.message}`, businessId: business.id },
        { status: 207 }
      );
    }
  }

  // 5) Default clinic hours.
  const hourRows = DEFAULT_HOURS.map((h, i) => ({
    business_id: business.id,
    day: h.day,
    start_time: h.start,
    end_time: h.end,
    sort_order: i,
  }));
  await supabase.from("kalendar_business_hours").insert(hourRows);

  return NextResponse.json({
    ok: true,
    userId,
    businessId: business.id,
    slug: business.slug,
  });
}
