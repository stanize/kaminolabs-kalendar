/**
 * Service field constraints shared by the form (UI) and the server actions
 * (authoritative validation). Values are language-neutral.
 */

export const DURATION_MIN_MINUTES = 5;
export const DURATION_MAX_MINUTES = 120;

/** Common durations offered in the dropdown (minutes). "custom" allows any in range. */
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120] as const;

export const PRICE_MIN = 0;
export const PRICE_MAX = 9999; // hard ceiling; the slider only spans the common range below
export const PRICE_SLIDER_MAX = 100; // slider range; the number box may exceed it (clamped slider)
export const PRICE_STEP = 5; // increment for the stepper arrows beside the slider

export const NAME_MAX_LENGTH = 80;

export type ServiceInput = {
  name: string;
  duration_min: number;
  price: number;
};

export type ServiceValidation =
  | { valid: true; value: ServiceInput }
  | { valid: false; error: string };

/** The translation slice validateService needs. Keeps this module free of any
 *  hardcoded language — callers supply the words via this shape, sourced from
 *  lib/i18n/dictionaries/services.ts's `validation` section. */
export interface ServiceValidationDict {
  errNameRequired: string;
  errNameTooLong: string; // contains "{max}"
  errDurationRange: string; // contains "{min}" and "{max}"
  errPriceInvalid: string;
}

/**
 * Validates and normalizes a service payload. Whole-euro prices only (no
 * decimals); duration is an integer within bounds. `dict` supplies the
 * UI-facing reason text (with {min}/{max} placeholders replaced here).
 */
export function validateService(
  raw: { name: string; duration_min: number; price: number },
  dict: ServiceValidationDict
): ServiceValidation {
  const name = raw.name.trim();
  if (name.length < 2) {
    return { valid: false, error: dict.errNameRequired };
  }
  if (name.length > NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: dict.errNameTooLong.replace("{max}", String(NAME_MAX_LENGTH)),
    };
  }

  const duration = Math.round(raw.duration_min);
  if (!Number.isFinite(duration) || duration < DURATION_MIN_MINUTES || duration > DURATION_MAX_MINUTES) {
    return {
      valid: false,
      error: dict.errDurationRange
        .replace("{min}", String(DURATION_MIN_MINUTES))
        .replace("{max}", String(DURATION_MAX_MINUTES)),
    };
  }

  const price = Math.round(raw.price);
  if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) {
    return { valid: false, error: dict.errPriceInvalid };
  }

  return { valid: true, value: { name, duration_min: duration, price } };
}
