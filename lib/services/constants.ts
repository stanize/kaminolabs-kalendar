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

/**
 * Validates and normalizes a service payload. Whole-euro prices only (no
 * decimals); duration is an integer within bounds. UI-facing errors in Spanish.
 */
export function validateService(raw: {
  name: string;
  duration_min: number;
  price: number;
}): ServiceValidation {
  const name = raw.name.trim();
  if (name.length < 2) {
    return { valid: false, error: "El nombre del servicio es obligatorio." };
  }
  if (name.length > NAME_MAX_LENGTH) {
    return { valid: false, error: `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres.` };
  }

  const duration = Math.round(raw.duration_min);
  if (!Number.isFinite(duration) || duration < DURATION_MIN_MINUTES || duration > DURATION_MAX_MINUTES) {
    return {
      valid: false,
      error: `La duración debe estar entre ${DURATION_MIN_MINUTES} y ${DURATION_MAX_MINUTES} minutos.`,
    };
  }

  const price = Math.round(raw.price);
  if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) {
    return { valid: false, error: "El precio no es válido." };
  }

  return { valid: true, value: { name, duration_min: duration, price } };
}
