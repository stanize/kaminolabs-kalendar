import type { Locale } from "../config";

/**
 * Dictionary for the "Horarios personalizados" tab of /panel/availability —
 * CustomTimeSlotsManager (components/panel/custom-time-slots-manager.tsx)
 * and lib/actions/custom-slots.ts's user-facing error messages. See
 * workflows/custom-time-slots.md.
 */
export interface CustomSlotsDictionary {
  title: string;
  subtitle: string;
  addButton: string; // "Añadir horario personalizado" (the + comes from the button icon)
  emptyTitle: string;
  emptySubtitle: string;

  // Type selector + "Frecuencia" fields (workflows/custom-time-slots.md,
  // slot-type-frequency)
  typeLabel: string;
  typeCustom: string;
  typeFrequency: string;
  startLabel: string;
  endLabel: string;
  frequencyLabel: string;
  frequencyOptionTemplate: string; // "{n}" minutes
  frequencyHint: string;
  previewTemplate: string; // "{n}" count, "{list}" first times
  previewInvalid: string;
  frequencySummaryTemplate: string; // "{start}", "{end}", "{n}"

  // Panel (create/edit)
  panelTitleNew: string;
  panelTitleEdit: string;
  close: string; // aria-label
  labelLabel: string;
  labelPlaceholder: string;
  daysLabel: string;
  allDays: string; // toggle option
  specificDays: string; // toggle option
  providersLabel: string;
  allProviders: string; // toggle option
  specificProviders: string; // toggle option
  timesLabel: string;
  timesHint: string; // tip: paste comma-separated times, HH:MM or HH
  timePlaceholder: string; // "HH:MM"
  addTimeButton: string;
  removeTimeAria: string;
  outsideHoursNote: string; // shown next to a flagged out-of-hours time
  cancel: string;
  save: string;
  saving: string;

  // List row
  editAria: string;
  deleteAria: string;
  confirmDelete: string; // window.confirm() prompt
  allDaysSummary: string; // "Todos los días"
  allProvidersSummary: string; // "Todos los profesionales"
  timesCountTemplate: string; // "{n} horario(s)"

  errUnexpected: string;
  errors: {
    errNoBusiness: string;
    errSaveFailed: string;
    errDeleteFailed: string;
    errTimesRequired: string;
    errInvalidTime: string; // "{time}"
    errInvalidDay: string;
    errInvalidProvider: string;
    errLabelTooLong: string; // "{max}"
    errInvalidRange: string;
    errInvalidFrequency: string;
    errInvalidType: string;
  };
}

const es: CustomSlotsDictionary = {
  title: "Horarios personalizados",
  subtitle: "Define horas de cita exactas para días y profesionales concretos, en vez de la sugerencia horaria genérica.",
  addButton: "Añadir horario personalizado",
  emptyTitle: "No tienes horarios personalizados",
  emptySubtitle: "Sin ninguno, las citas siguen usando la sugerencia horaria genérica basada en tu Horario.",

  typeLabel: "Tipo",
  typeCustom: "Personalizado",
  typeFrequency: "Frecuencia",
  startLabel: "Hora de inicio",
  endLabel: "Hora de fin",
  frequencyLabel: "Frecuencia",
  frequencyOptionTemplate: "Cada {n} min",
  frequencyHint: "La hora de fin no se incluye como hora de cita.",
  previewTemplate: "Se crearán {n} horarios: {list}",
  previewInvalid: "La hora de fin debe ser posterior a la de inicio.",
  frequencySummaryTemplate: "{start}–{end} · cada {n} min",

  panelTitleNew: "Nuevo horario personalizado",
  panelTitleEdit: "Editar horario personalizado",
  close: "Cerrar",
  labelLabel: "Nombre",
  labelPlaceholder: "ej. Horario de mañanas",
  daysLabel: "Días",
  allDays: "Todos los días",
  specificDays: "Días concretos",
  providersLabel: "Profesionales",
  allProviders: "Todos los profesionales",
  specificProviders: "Profesionales concretos",
  timesLabel: "Horarios",
  timesHint: "Consejo: puedes pegar varias horas separadas por comas (ej. 9:45,10:30,12,14:30) y se crearán filas automáticamente.",
  timePlaceholder: "HH:MM",
  addTimeButton: "Añadir hora",
  removeTimeAria: "Eliminar hora",
  outsideHoursNote: "Fuera de tu horario habitual",
  cancel: "Cancelar",
  save: "Guardar",
  saving: "Guardando…",

  editAria: "Editar",
  deleteAria: "Eliminar",
  confirmDelete: "¿Eliminar este horario personalizado?",
  allDaysSummary: "Todos los días",
  allProvidersSummary: "Todos los profesionales",
  timesCountTemplate: "{n} horario(s)",

  errUnexpected: "Ha ocurrido un error inesperado.",
  errors: {
    errNoBusiness: "Primero configura tu negocio.",
    errSaveFailed: "No se pudo guardar:",
    errDeleteFailed: "No se pudo eliminar:",
    errTimesRequired: "Añade al menos un horario.",
    errInvalidTime: "La hora \"{time}\" no es válida.",
    errInvalidDay: "Día no válido.",
    errInvalidProvider: "Uno de los profesionales elegidos no existe.",
    errLabelTooLong: "El nombre no puede superar los {max} caracteres.",
    errInvalidRange: "La hora de fin debe ser posterior a la de inicio.",
    errInvalidFrequency: "Frecuencia no válida.",
    errInvalidType: "Tipo de horario no válido.",
  },
};

const en: CustomSlotsDictionary = {
  title: "Custom time slots",
  subtitle: "Define exact appointment times for specific days and providers, instead of the generic hourly suggestion.",
  addButton: "Add custom time slot",
  emptyTitle: "No custom time slots yet",
  emptySubtitle: "Without any, appointments keep using the generic hourly suggestion based on your Hours.",

  typeLabel: "Type",
  typeCustom: "Custom",
  typeFrequency: "Frequency",
  startLabel: "Start time",
  endLabel: "End time",
  frequencyLabel: "Frequency",
  frequencyOptionTemplate: "Every {n} min",
  frequencyHint: "The end time itself is not offered as an appointment time.",
  previewTemplate: "{n} times will be created: {list}",
  previewInvalid: "The end time must be after the start time.",
  frequencySummaryTemplate: "{start}–{end} · every {n} min",

  panelTitleNew: "New custom time slot",
  panelTitleEdit: "Edit custom time slot",
  close: "Close",
  labelLabel: "Name",
  labelPlaceholder: "e.g. Morning schedule",
  daysLabel: "Days",
  allDays: "All days",
  specificDays: "Specific days",
  providersLabel: "Providers",
  allProviders: "All providers",
  specificProviders: "Specific providers",
  timesLabel: "Times",
  timesHint: "Tip: you can paste several times separated by commas (e.g. 9:45,10:30,12,14:30) and rows will be created automatically.",
  timePlaceholder: "HH:MM",
  addTimeButton: "Add time",
  removeTimeAria: "Remove time",
  outsideHoursNote: "Outside your usual hours",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving…",

  editAria: "Edit",
  deleteAria: "Delete",
  confirmDelete: "Delete this custom time slot?",
  allDaysSummary: "All days",
  allProvidersSummary: "All providers",
  timesCountTemplate: "{n} time(s)",

  errUnexpected: "An unexpected error occurred.",
  errors: {
    errNoBusiness: "Set up your business first.",
    errSaveFailed: "Couldn't save:",
    errDeleteFailed: "Couldn't delete:",
    errTimesRequired: "Add at least one time.",
    errInvalidTime: "The time \"{time}\" isn't valid.",
    errInvalidDay: "Invalid day.",
    errInvalidProvider: "One of the chosen providers doesn't exist.",
    errLabelTooLong: "The name can't be longer than {max} characters.",
    errInvalidRange: "The end time must be after the start time.",
    errInvalidFrequency: "Invalid frequency.",
    errInvalidType: "Invalid slot type.",
  },
};

const CUSTOM_SLOTS_DICTIONARIES: Record<Locale, CustomSlotsDictionary> = { es, en };

export function getCustomSlotsDictionary(locale: Locale): CustomSlotsDictionary {
  return CUSTOM_SLOTS_DICTIONARIES[locale];
}
