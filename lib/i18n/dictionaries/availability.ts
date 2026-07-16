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
    rangeJoiner: string; // between start and end times, e.g. "09:00 a 13:00"
    saved: string;
    bookingWindowQuestion: string;
    month: string;
    months: string;
    confirmButton: string;
    confirming: string;
    errUnexpected: string;
    rangeAt: string; // joins day + range error, contains "{day}" and "{error}"
    conflictTitle: string; // "Hay citas fuera del nuevo horario" warning modal title
    conflictBodyTemplate: string; // "{n} cita(s) existentes quedarían fuera..." contains "{n}"
    conflictItemTemplate: string; // one row per conflict, contains "{date}", "{client}", "{service}"
    conflictSaveAnyway: string; // confirm button
    conflictCancel: string; // cancel button
    checkingConflicts: string; // brief loading label while the pre-save check runs
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
    errCheckFailed: string; // prefix; server detail appended, from checkAvailabilityConflicts
  };
  weekdays: Record<DayId, string>;
  weekdaysShort: Record<DayId, string>; // wizard day pills
  wizard: {
    // First-time setup wizard (AvailabilitySetupWizard + review banner in
    // AvailabilityManager). Steps: days -> hours -> review (review = the grid).
    stepLabel: string; // contains "{n}" and "{total}"
    daysTitle: string;
    daysSubtitle: string;
    hoursTitle: string;
    hoursSubtitle: string; // contains "{count}" (2+ selected days)
    hoursSubtitleOne: string; // singular variant (exactly 1 selected day)
    reviewTitle: string;
    reviewSubtitle: string;
    back: string;
    next: string;
    finishButton: string;
    errNoDays: string;
  };
  intlLocale: string; // for Intl.DateTimeFormat when listing conflicting bookings
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
    rangeJoiner: "a",
    saved: "¡Guardado correctamente!",
    bookingWindowQuestion: "¿Con cuánta antelación pueden reservar?",
    month: "mes",
    months: "meses",
    confirmButton: "Confirmar cambios",
    confirming: "Guardando…",
    errUnexpected: "Ocurrió un error inesperado. Inténtalo de nuevo.",
    rangeAt: "{day}: {error}",
    conflictTitle: "Hay citas fuera del nuevo horario",
    conflictBodyTemplate: "{n} cita(s) ya confirmadas quedarían fuera del horario que estás guardando. Si continúas, esas citas seguirán existiendo pero fuera de tu horario de atención:",
    conflictItemTemplate: "{date} · {client} · {service}",
    conflictSaveAnyway: "Guardar de todas formas",
    conflictCancel: "Cancelar",
    checkingConflicts: "Comprobando citas existentes…",
  },
  validation: {
    errEndBeforeStart: "La hora de fin debe ser posterior a la de inicio.",
    errOverlap: "Los horarios de un mismo día no pueden solaparse.",
  },
  errors: {
    errNoBusiness: "Primero configura tu negocio.",
    errInvalidWindow: "Ventana de reservas no válida.",
    errSaveFailed: "No se pudo guardar:",
    errCheckFailed: "No se pudieron comprobar las citas existentes:",
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
  weekdaysShort: {
    mon: "Lun",
    tue: "Mar",
    wed: "Mié",
    thu: "Jue",
    fri: "Vie",
    sat: "Sáb",
    sun: "Dom",
  },
  wizard: {
    stepLabel: "Paso {n} de {total}",
    daysTitle: "¿Qué días abres?",
    daysSubtitle: "Podrás ajustar cada día por separado al final.",
    hoursTitle: "Tu horario habitual",
    hoursSubtitle:
      "Se aplicará a los {count} días seleccionados. Después podrás editar cada día por separado.",
    hoursSubtitleOne: "Se aplicará al día seleccionado. Después podrás editarlo cuando quieras.",
    reviewTitle: "Revisa tu semana",
    reviewSubtitle: "Ajusta cualquier día antes de confirmar.",
    back: "Atrás",
    next: "Siguiente",
    finishButton: "Confirmar y terminar",
    errNoDays: "Selecciona al menos un día.",
  },
  intlLocale: "es-ES",
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
    rangeJoiner: "to",
    saved: "Saved successfully!",
    bookingWindowQuestion: "How far ahead can clients book?",
    month: "month",
    months: "months",
    confirmButton: "Save changes",
    confirming: "Saving…",
    errUnexpected: "An unexpected error occurred. Please try again.",
    rangeAt: "{day}: {error}",
    conflictTitle: "There are appointments outside the new hours",
    conflictBodyTemplate: "{n} confirmed appointment(s) would fall outside the hours you're about to save. If you continue, those bookings will still exist, just outside your working hours:",
    conflictItemTemplate: "{date} · {client} · {service}",
    conflictSaveAnyway: "Save anyway",
    conflictCancel: "Cancel",
    checkingConflicts: "Checking existing appointments…",
  },
  validation: {
    errEndBeforeStart: "The end time must be after the start time.",
    errOverlap: "Time ranges on the same day can't overlap.",
  },
  errors: {
    errNoBusiness: "Set up your business first.",
    errInvalidWindow: "Invalid booking window.",
    errSaveFailed: "Couldn't save:",
    errCheckFailed: "Couldn't check existing appointments:",
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
  weekdaysShort: {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  },
  wizard: {
    stepLabel: "Step {n} of {total}",
    daysTitle: "Which days are you open?",
    daysSubtitle: "You'll be able to adjust each day individually at the end.",
    hoursSubtitle:
      "These hours will apply to the {count} selected days. You can edit each day individually afterwards.",
    hoursSubtitleOne: "These hours will apply to the selected day. You can edit it anytime afterwards.",
    hoursTitle: "Your usual hours",
    reviewTitle: "Review your week",
    reviewSubtitle: "Adjust any day before confirming.",
    back: "Back",
    next: "Next",
    finishButton: "Confirm and finish",
    errNoDays: "Select at least one day.",
  },
  intlLocale: "en-GB",
};

const AVAILABILITY_DICTIONARIES: Record<Locale, AvailabilityDictionary> = { es, en };

export function getAvailabilityDictionary(locale: Locale): AvailabilityDictionary {
  return AVAILABILITY_DICTIONARIES[locale];
}
