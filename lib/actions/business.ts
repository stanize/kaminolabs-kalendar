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
import { lookupPostalCode as lookupPostalCodeData } from "@/lib/business/postal-codes";
import { getBusinessForUser } from "@/lib/business/data";

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
  async (
    session,
    rawSlug: string,
    dict?: {
      errSlugReserved: string;
      errSlugFlagged: string;
      errSlugTooShort: string;
      errSlugTooLong: string;
      errSlugInvalidChars: string;
    }
  ): Promise<SlugCheckResult> => {
    const slug = sanitizeSlug(rawSlug);

    const format = validateSlugFormat(slug, {
      errSlugTooShort: dict?.errSlugTooShort ?? "El enlace debe tener al menos {min} caracteres.",
      errSlugTooLong: dict?.errSlugTooLong ?? "El enlace no puede superar los {max} caracteres.",
      errSlugInvalidChars:
        dict?.errSlugInvalidChars ??
        "Usa solo minúsculas, números y guiones (sin espacios ni guiones al inicio o final).",
    });
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
            ? dict?.errSlugReserved ?? "Ese enlace está reservado. Elige otro."
            : dict?.errSlugFlagged ??
              "Ese enlace podría no estar permitido y quedará pendiente de revisión.",
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

// ── Postal-code autofill (city + province) ─────────────────────────────────
// Free, static-dataset lookup — no external API call. Purely a UX suggestion:
// the form fields it fills remain fully editable, and a miss (unknown code,
// still-typing) is a normal, silent outcome, not an error.
export type PostalCodeLookupResult = { city: string; province: string } | null;

export const lookupPostalCode = authedAction(
  async (_session, cp: string): Promise<PostalCodeLookupResult> => {
    return lookupPostalCodeData(cp);
  }
);

// ── Save business settings (create or update) ──────────────────────────────
export type SaveBusinessResult =
  | { ok: true; slug: string; pendingReview: boolean }
  | { ok: false; error: string };

export const saveBusinessSettings = authedAction(
  async (
    session,
    formData: FormData,
    dict?: {
      errName: string;
      errType: string;
      errCity: string;
      errAddressStreet: string;
      errAddressNumber: string;
      errAddressPostalCode: string;
      errAddressProvince: string;
      errAddressCountry: string;
      errPhone: string;
      errContactEmail: string;
      errSlugTaken: string;
      errSaveFailed: string;
      errCreateFailed: string;
      errSlugTooShort: string;
      errSlugTooLong: string;
      errSlugInvalidChars: string;
    }
  ): Promise<SaveBusinessResult> => {
    const name = (formData.get("name") as string | null)?.trim() ?? "";
    const type = (formData.get("type") as string | null)?.trim() ?? "";
    const city = (formData.get("city") as string | null)?.trim() ?? "";
    const legalId = (formData.get("legalId") as string | null)?.trim() ?? "";
    const addressStreet = (formData.get("addressStreet") as string | null)?.trim() ?? "";
    const addressNumber = (formData.get("addressNumber") as string | null)?.trim() ?? "";
    const addressAdditional = (formData.get("addressAdditional") as string | null)?.trim() ?? "";
    const addressPostalCode = (formData.get("addressPostalCode") as string | null)?.trim() ?? "";
    const addressProvince = (formData.get("addressProvince") as string | null)?.trim() ?? "";
    const addressCountry = (formData.get("addressCountry") as string | null)?.trim() ?? "";
    const phoneCountryCode = (formData.get("phoneCountryCode") as string | null)?.trim() ?? "";
    const phone = (formData.get("phone") as string | null)?.trim() ?? "";
    const contactEmail = (formData.get("contactEmail") as string | null)?.trim() ?? "";

    if (name.length < 2) {
      return { ok: false, error: dict?.errName ?? "El nombre del negocio es obligatorio." };
    }
    if (!isValidType(type)) {
      return { ok: false, error: dict?.errType ?? "Selecciona el tipo de negocio." };
    }
    if (addressStreet.length < 3) {
      return { ok: false, error: dict?.errAddressStreet ?? "La dirección es obligatoria." };
    }
    if (addressNumber.length < 1) {
      return { ok: false, error: dict?.errAddressNumber ?? "El número es obligatorio." };
    }
    if (city.length < 2) {
      return { ok: false, error: dict?.errCity ?? "La ciudad es obligatoria." };
    }
    if (addressPostalCode.length < 3) {
      return { ok: false, error: dict?.errAddressPostalCode ?? "El código postal es obligatorio." };
    }
    if (addressProvince.length < 2) {
      return { ok: false, error: dict?.errAddressProvince ?? "La provincia es obligatoria." };
    }
    if (addressCountry.length < 2) {
      return { ok: false, error: dict?.errAddressCountry ?? "El país es obligatorio." };
    }
    if (!/^\+\d{1,4}$/.test(phoneCountryCode)) {
      return { ok: false, error: dict?.errPhone ?? "El teléfono es obligatorio." };
    }
    if (phone.length < 5) {
      return { ok: false, error: dict?.errPhone ?? "El teléfono es obligatorio." };
    }
    if (!contactEmail.includes("@")) {
      return { ok: false, error: dict?.errContactEmail ?? "El email de contacto es obligatorio." };
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
        .update({
          name,
          type,
          legal_id: legalId || null,
          address_street: addressStreet,
          address_number: addressNumber,
          address_additional: addressAdditional || null,
          city,
          address_postal_code: addressPostalCode,
          address_province: addressProvince,
          address_country: addressCountry,
          phone_country_code: phoneCountryCode,
          phone_number: phone,
          contact_email: contactEmail,
        })
        .eq("id", existing.id)
        .eq("owner_id", session.user.id); // defence in depth

      if (error) {
        return {
          ok: false,
          error: `${dict?.errSaveFailed ?? "No se pudo guardar:"} ${error.message}`,
        };
      }
      revalidatePath("/panel");
      revalidatePath("/panel/business");
      return { ok: true, slug: existing.slug as string, pendingReview: false };
    }

    // ── CREATE ──────────────────────────────────────────────────────────────
    const slug = sanitizeSlug((formData.get("slug") as string | null) ?? "");

    const format = validateSlugFormat(slug, {
      errSlugTooShort: dict?.errSlugTooShort ?? "El enlace debe tener al menos {min} caracteres.",
      errSlugTooLong: dict?.errSlugTooLong ?? "El enlace no puede superar los {max} caracteres.",
      errSlugInvalidChars:
        dict?.errSlugInvalidChars ??
        "Usa solo minúsculas, números y guiones (sin espacios ni guiones al inicio o final).",
    });
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
        error: dict?.errSlugTaken ?? "Ese enlace ya está en uso. Elige otro.",
      };
    }

    const { error } = await supabase.from("kalendar_businesses").insert({
      owner_id: session.user.id,
      name,
      type,
      legal_id: legalId || null,
      address_street: addressStreet,
      address_number: addressNumber,
      address_additional: addressAdditional || null,
      city,
      address_postal_code: addressPostalCode,
      address_province: addressProvince,
      address_country: addressCountry,
      phone_country_code: phoneCountryCode,
      phone_number: phone,
      contact_email: contactEmail,
      slug,
      slug_status: slugStatus,
      slug_flag_reason: slugFlagReason,
    });

    if (error) {
      // Unique-constraint race between the check and the insert.
      if (error.code === "23505") {
        return { ok: false, error: dict?.errSlugTaken ?? "Ese enlace ya está en uso. Elige otro." };
      }
      return {
        ok: false,
        error: `${dict?.errCreateFailed ?? "No se pudo crear el negocio:"} ${error.message}`,
      };
    }

    revalidatePath("/panel");
    revalidatePath("/panel/business");
    return { ok: true, slug, pendingReview: !screen.clean };
  }
);

// ── Logo upload ──────────────────────────────────────────────────────────

export type UploadLogoResult =
  | { ok: true; logoUrl: string }
  | { ok: false; error: string };

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // matches business-logos bucket's file_size_limit
const LOGO_ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/**
 * Uploads a clinic's logo to the business-logos storage bucket (see
 * supabase/schema_001.sql) and saves the public URL on kalendar_businesses.
 * Same upload pattern as lib/actions/support.ts's attachment handling —
 * server-side upload via the service-role Supabase client (no client-side
 * bucket RLS needed, matching that precedent). Old logo file is deleted
 * from storage on replace, so orphaned files don't accumulate.
 */
export const uploadBusinessLogo = authedAction(
  async (session, formData: FormData, dict?: { errNoBusiness: string; errInvalidFile: string; errUploadFailed: string }): Promise<UploadLogoResult> => {
    const t = {
      errNoBusiness: dict?.errNoBusiness ?? "No se encontró tu negocio.",
      errInvalidFile: dict?.errInvalidFile ?? "Sube una imagen PNG, JPG, WEBP o SVG de menos de 2MB.",
      errUploadFailed: dict?.errUploadFailed ?? "No se pudo subir el logo.",
    };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const file = formData.get("logo") as File | null;
    if (!file || file.size === 0) return { ok: false, error: t.errInvalidFile };
    if (file.size > LOGO_MAX_BYTES || !LOGO_ALLOWED_TYPES.has(file.type)) {
      return { ok: false, error: t.errInvalidFile };
    }

    const supabase = await createClient();
    const ext = file.name.split(".").pop() ?? "png";
    const fileName = `${business.id}/logo-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("business-logos")
      .upload(fileName, new Uint8Array(arrayBuffer), { contentType: file.type, upsert: false });

    if (uploadError) return { ok: false, error: t.errUploadFailed };

    const { data: publicUrlData } = supabase.storage.from("business-logos").getPublicUrl(fileName);
    const logoUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("kalendar_businesses")
      .update({ logo_url: logoUrl })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);

    if (updateError) return { ok: false, error: t.errUploadFailed };

    // Best-effort cleanup of the previous logo file — not fatal if it fails
    // (an orphaned file in storage costs nothing functionally, just some
    // unused storage), so this doesn't affect the result returned above.
    if (business.logo_url) {
      const prevPath = business.logo_url.split("/business-logos/")[1];
      if (prevPath) {
        await supabase.storage.from("business-logos").remove([prevPath]);
      }
    }

    revalidatePath("/panel/business");
    revalidatePath(`/bookings/${business.slug}`);
    return { ok: true, logoUrl };
  }
);

export type RemoveLogoResult = { ok: true } | { ok: false; error: string };

export const removeBusinessLogo = authedAction(
  async (session, dict?: { errNoBusiness: string; errSaveFailed: string }): Promise<RemoveLogoResult> => {
    const t = {
      errNoBusiness: dict?.errNoBusiness ?? "No se encontró tu negocio.",
      errSaveFailed: dict?.errSaveFailed ?? "No se pudo guardar el cambio.",
    };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_businesses")
      .update({ logo_url: null })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);

    if (error) return { ok: false, error: t.errSaveFailed };

    if (business.logo_url) {
      const prevPath = business.logo_url.split("/business-logos/")[1];
      if (prevPath) {
        await supabase.storage.from("business-logos").remove([prevPath]);
      }
    }

    revalidatePath("/panel/business");
    revalidatePath(`/bookings/${business.slug}`);
    return { ok: true };
  }
);
