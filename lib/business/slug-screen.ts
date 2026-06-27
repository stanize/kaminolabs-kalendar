import { isReservedSlug } from "./reserved-slugs";

/**
 * Slug rules and the automated moderation screen applied at creation.
 *
 * A slug is permanent once created (changes are handled out-of-band as a support
 * request), so creation is the only place it is chosen and validated.
 *
 * Format: lowercase a-z, 0-9, single hyphens; no leading/trailing/double
 * hyphens; length 3-40.
 *
 * The automated screen is a first-pass triage only — EVERY slug is also queued
 * for human review regardless of the screen result (see kalendar_businesses
 * .slug_reviewed_at). The screen merely decides whether a slug may go live
 * immediately ('active') or must be held offline until approved
 * ('pending_review').
 */

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Turns arbitrary text into a slug-safe form: lowercase, accents stripped,
 * non-alphanumerics collapsed to single hyphens, trimmed. Used both to build
 * the suggestion from the business name and to sanitize live keystrokes.
 * May return "" for input with no usable characters.
 */
export function sanitizeSlug(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, ""); // a trailing hyphen can survive the slice
}

/** Suggested slug from a business name, e.g. "Centro Bienestar" -> "centro-bienestar". */
export function suggestSlug(businessName: string): string {
  return sanitizeSlug(businessName);
}

export type SlugFormatResult =
  | { valid: true }
  | { valid: false; reason: string };

/** Validates slug FORMAT only (length + character rules). UI-facing reasons in Spanish. */
export function validateSlugFormat(slug: string): SlugFormatResult {
  if (slug.length < SLUG_MIN_LENGTH) {
    return { valid: false, reason: `El enlace debe tener al menos ${SLUG_MIN_LENGTH} caracteres.` };
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    return { valid: false, reason: `El enlace no puede superar los ${SLUG_MAX_LENGTH} caracteres.` };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      reason: "Usa solo minúsculas, números y guiones (sin espacios ni guiones al inicio o final).",
    };
  }
  return { valid: true };
}

/**
 * Banned substrings for the profanity/abuse screen. Normalized, lowercase,
 * matched as substrings against the de-hyphenated slug so "f-u-c-k" style
 * evasion via hyphens is also caught. Intentionally small and conservative —
 * human review is the real backstop. Extend as needed.
 */
const PROFANITY_TERMS: readonly string[] = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "nigger",
  "faggot",
  "rape",
  "nazi",
  "porn",
  "sex",
  "xxx",
  // Spanish
  "puta",
  "puto",
  "mierda",
  "joder",
  "cabron",
  "polla",
  "coño",
  "marica",
  "zorra",
];

/** Internal flag codes — English, mapped to UI copy by the caller if shown. */
export type SlugFlagReason = "reserved" | "profanity";

export type SlugScreenResult =
  | { clean: true }
  | { clean: false; reason: SlugFlagReason };

/**
 * Automated screen run at creation on a FORMAT-VALID slug. Returns clean, or a
 * machine-readable reason. Clean slugs may go live immediately (still queued for
 * review); flagged slugs start held as 'pending_review'.
 */
export function screenSlug(slug: string): SlugScreenResult {
  if (isReservedSlug(slug)) {
    return { clean: false, reason: "reserved" };
  }
  const collapsed = slug.replace(/-/g, "");
  for (const term of PROFANITY_TERMS) {
    if (collapsed.includes(term)) {
      return { clean: false, reason: "profanity" };
    }
  }
  return { clean: true };
}
