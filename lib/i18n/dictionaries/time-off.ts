import type { Locale } from "../config";

/**
 * Dictionary for the per-provider time off section on /panel/team —
 * TimeOffList (components/panel/time-off-list.tsx), the expand/collapse
 * toggle in TeamManager, and the user-facing error messages from
 * createTimeOff/deleteClosure (lib/actions/closures.ts). See
 * workflows/holidays-and-time-off.md -> provider-time-off.
 */
export interface TimeOffDictionary {
  title: string; // section heading on /panel/availability
  subtitle: string;
  toggleShow: string; // "Vacaciones / ausencias"
  toggleHide: string;
  startDate: string;
  endDate: string;
  dayLabel: string; // replaces startDate's label when singleDay is checked
  singleDay: string; // "Solo un día" checkbox label
  partialHours: string; // checkbox label
  startTime: string;
  endTime: string;
  nameLabel: string;
  namePlaceholder: string;
  add: string;
  delete: string; // aria-label
  errUnexpected: string;
  errors: {
    errNoBusiness: string;
    errSaveFailed: string; // prefix; server detail appended
    errDeleteFailed: string; // prefix; server detail appended
    errInvalidRecurringDate: string;
    errInvalidDateRange: string;
    errInvalidTimeRange: string;
    errLabelTooLong: string; // contains "{max}"
  };
}

const es: TimeOffDictionary = {
  title: "Vacaciones y ausencias del equipo",
  subtitle: "Días u horas concretas en que un profesional no está disponible.",
  toggleShow: "Vacaciones / ausencias",
  toggleHide: "Ocultar vacaciones / ausencias",
  startDate: "Desde",
  endDate: "Hasta",
  dayLabel: "Día",
  singleDay: "Solo un día",
  partialHours: "Solo parte del día (mismo día)",
  startTime: "Desde las",
  endTime: "Hasta las",
  nameLabel: "Motivo (opcional)",
  namePlaceholder: "Ej. Vacaciones",
  add: "Añadir",
  delete: "Eliminar",
  errUnexpected: "Ocurrió un error inesperado. Inténtalo de nuevo.",
  errors: {
    errNoBusiness: "Primero configura tu negocio.",
    errSaveFailed: "No se pudo guardar:",
    errDeleteFailed: "No se pudo eliminar:",
    errInvalidRecurringDate: "La fecha no es válida.",
    errInvalidDateRange: "El rango de fechas no es válido.",
    errInvalidTimeRange: "El horario no es válido.",
    errLabelTooLong: "El motivo no puede superar los {max} caracteres.",
  },
};

const en: TimeOffDictionary = {
  title: "Team time off",
  subtitle: "Specific days or hours when a provider is unavailable.",
  toggleShow: "Time off",
  toggleHide: "Hide time off",
  startDate: "From",
  endDate: "To",
  dayLabel: "Day",
  singleDay: "Single day only",
  partialHours: "Only part of the day (same day)",
  startTime: "From",
  endTime: "To",
  nameLabel: "Reason (optional)",
  namePlaceholder: "E.g. Vacation",
  add: "Add",
  delete: "Delete",
  errUnexpected: "Something went wrong. Please try again.",
  errors: {
    errNoBusiness: "Set up your business first.",
    errSaveFailed: "Couldn't save:",
    errDeleteFailed: "Couldn't delete:",
    errInvalidRecurringDate: "That date isn't valid.",
    errInvalidDateRange: "That date range isn't valid.",
    errInvalidTimeRange: "That time range isn't valid.",
    errLabelTooLong: "The reason can't be longer than {max} characters.",
  },
};

const TIME_OFF_DICTIONARIES: Record<Locale, TimeOffDictionary> = { es, en };

export function getTimeOffDictionary(locale: Locale): TimeOffDictionary {
  return TIME_OFF_DICTIONARIES[locale];
}
