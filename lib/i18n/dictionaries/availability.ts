import type { Locale } from "../config";
import type { DayId } from "@/lib/onboarding/types";

/**
 * Dictionary for the Disponibilidad (availability) panel page: the page
 * itself, AvailabilityManager (weekly hours grid, time dropdowns, booking
 * window), validateDayRanges (lib/availability/constants.ts, which takes this
 * dict's validation keys as a parameter — same pattern as slug-screen.ts and
 * services constants.ts), the user-facing error messages from
 * lib/actions/availability.ts, and the weekday full names (this page is the
 * sole consumer of weekdayLabel today, so the names live here rather than in a
 * separate shared file).
 */
export interface AvailabilityDictionary {
  page: {
    title: string;
    subtitle: string;
  };
  manager: {
    closed: string;
    removeRange: string; // aria-label
    addRange: string;
    saved: string;
    bookingWindowQuestion: string;
    month: string;
    months: string;
    confirmButton: string;
    confirming: string;
    errUnexpected: string;
    rangeAt: string; // joins day + range error, contains "{day}" and "{error}"
  };
  validation: {
    // validateDayRanges (lib/availability/constants.ts)
    errEndBeforeStart: string;
    errOverlap: string;
  };
  errors: {
    // lib/actions/availability.ts
    errNoBusiness: string;
    errInvalidWindow: string;
    errSaveFailed: string; // prefix; server detail appended
  };
  weekdays: Record<DayId, string>;
}

const es: AvailabilityDictionary = {
  page: {
    title: "Tu disponibilidad",
    subtitle: "Define los días y las horas en que aceptas citas.",
  },
  manager: {
    closed: "Cerrado",
    removeRange: "Quitar franja",
    addRange: "Añadir franja",
    saved: "Guardado correctamente.",
    bookingWindowQuestion: "¿Con cuánta antelación pueden reservar?",
    month: "mes",
    months: "meses",
    confirmButton: "Confirmar cambios",
    confirming: "Guardando…",
    errUnexpected: "Ocurrió un error inesperado. Inténtalo de nuevo.",
    rangeAt: "{day}: {error}",
  },
  validation: {
    errEndBeforeStart: "La hora de fin debe ser posterior a la de inicio.",
    errOverlap: "Los horarios de un mismo día no pueden solaparse.",
  },
  errors: {
    errNoBusiness: "Primero configura tu negocio.",
    errInvalidWindow: "Ventana de reservas no válida.",
    errSaveFailed: "No se pudo guardar:",
  },
  weekdays: {
    mon: "Lunes",
    tue: "Martes",
    wed: "Miércoles",
    thu: "Jueves",
    fri: "Viernes",
    sat: "Sábado",
    sun: "Domingo",
  },
};

const en: AvailabilityDictionary = {
  page: {
    title: "Your availability",
    subtitle: "Set the days and hours you accept appointments.",
  },
  manager: {
    closed: "Closed",
    removeRange: "Remove range",
    addRange: "Add range",
    saved: "Saved successfully.",
    bookingWindowQuestion: "How far ahead can clients book?",
    month: "month",
    months: "months",
    confirmButton: "Save changes",
    confirming: "Saving…",
    errUnexpected: "An unexpected error occurred. Please try again.",
    rangeAt: "{day}: {error}",
  },
  validation: {
    errEndBeforeStart: "The end time must be after the start time.",
    errOverlap: "Time ranges on the same day can't overlap.",
  },
  errors: {
    errNoBusiness: "Set up your business first.",
    errInvalidWindow: "Invalid booking window.",
    errSaveFailed: "Couldn't save:",
  },
  weekdays: {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  },
};

const AVAILABILITY_DICTIONARIES: Record<Locale, AvailabilityDictionary> = { es, en };

export function getAvailabilityDictionary(locale: Locale): AvailabilityDictionary {
  return AVAILABILITY_DICTIONARIES[locale];
}
