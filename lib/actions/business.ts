"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_TYPES } from "@/lib/onboarding/data";
import type { BusinessType } from "@/lib/onboarding/types";
import {
  sanitizeSlug,
  validateSlugFormat,
  screenSlug,
} from "@/lib/business/slug-screen";

const VALID_TYPES = new Set<string>(BUSINESS_TYPES.map((t) => t.id));

function isValidType(value: string): value is BusinessType {
  return VALID_TYPES.has(value);
}

// ── Slug availability check (UX only) ──────────────────────────────────────
// Authoritative uniqueness is re-checked at write time; this is for live
// feedback in the creation form. Treats the caller's own existing slug as
// available so editing one's own (not currently possible, but safe) never
// reports a false collision.
export type SlugCheckResult =
  | { status: "available" }
  | { status: "taken" }
  | { status: "invalid"; reason: string }
  | { status: "flagged"; reason: string };

export const checkSlugAvailability = authedAction(
  async (session, rawSlug: string): Promise<SlugCheckResult> => {
    const slug = sanitizeSlug(rawSlug);

    const format = validateSlugFormat(slug);
    if (!format.valid) {
      return { status: "invalid", reason: format.reason };
    }

    // Surface the automated screen result so the user knows a slug will be held
    // for review before it can go live (it is not a hard block — they may still
    // submit it; it just starts as pending_review).
    const screen = screenSlug(slug);
    if (!screen.clean) {
      return {
        status: "flagged",
        reason:
          screen.reason === "reserved"
            ? "Ese enlace está reservado. Elige otro."
            : "Ese enlace podría no estar permitido y quedará pendiente de revisión.",
      };
    }

    const supabase = await createClient();
    const { data } = await supabase
      .from("kalendar_businesses")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (data && data.owner_id !== session.user.id) {
      return { status: "taken" };
    }
    return { status: "available" };
  }
);

// ── Save business settings (create or update) ──────────────────────────────
export type SaveBusinessResult =
  | { ok: true; slug: string; pendingReview: boolean }
  | { ok: false; error: string };

export const saveBusinessSettings = authedAction(
  async (session, formData: FormData): Promise<SaveBusinessResult> => {
    const name = (formData.get("name") as string | null)?.trim() ?? "";
    const type = (formData.get("type") as string | null)?.trim() ?? "";
    const city = (formData.get("city") as string | null)?.trim() ?? "";

    if (name.length < 2) {
      return { ok: false, error: "El nombre del negocio es obligatorio." };
    }
    if (!isValidType(type)) {
      return { ok: false, error: "Selecciona el tipo de negocio." };
    }

    const supabase = await createClient();

    // Does this user already have a business? Determines create vs update.
    const { data: existing } = await supabase
      .from("kalendar_businesses")
      .select("id, slug")
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── UPDATE ──────────────────────────────────────────────────────────────
    // Slug is immutable after creation: any slug in the payload is ignored and
    // the stored slug is preserved. Only name/type/city change.
    if (existing) {
      const { error } = await supabase
        .from("kalendar_businesses")
        .update({ name, type, city: city || null })
        .eq("id", existing.id)
        .eq("owner_id", session.user.id); // defence in depth

      if (error) {
        return { ok: false, error: `No se pudo guardar: ${error.message}` };
      }
      revalidatePath("/panel");
      revalidatePath("/panel/business");
      return { ok: true, slug: existing.slug as string, pendingReview: false };
    }

    // ── CREATE ──────────────────────────────────────────────────────────────
    const slug = sanitizeSlug((formData.get("slug") as string | null) ?? "");

    const format = validateSlugFormat(slug);
    if (!format.valid) {
      return { ok: false, error: format.reason };
    }

    // Automated screen decides initial visibility. Either way the row enters the
    // human review queue (slug_reviewed_at left null).
    const screen = screenSlug(slug);
    const slugStatus = screen.clean ? "active" : "pending_review";
    const slugFlagReason = screen.clean ? null : screen.reason;

    // Authoritative uniqueness check (the live check is advisory only).
    const { data: clash } = await supabase
      .from("kalendar_businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (clash) {
      return {
        ok: false,
        error: "Ese enlace ya está en uso. Elige otro.",
      };
    }

    const { error } = await supabase.from("kalendar_businesses").insert({
      owner_id: session.user.id,
      name,
      type,
      city: city || null,
      slug,
      slug_status: slugStatus,
      slug_flag_reason: slugFlagReason,
    });

    if (error) {
      // Unique-constraint race between the check and the insert.
      if (error.code === "23505") {
        return { ok: false, error: "Ese enlace ya está en uso. Elige otro." };
      }
      return { ok: false, error: `No se pudo crear el negocio: ${error.message}` };
    }

    revalidatePath("/panel");
    revalidatePath("/panel/business");
    return { ok: true, slug, pendingReview: !screen.clean };
  }
);
