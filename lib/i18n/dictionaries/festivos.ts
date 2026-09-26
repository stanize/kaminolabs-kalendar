import type { Locale } from "../config";

/**
 * Dictionary for the Festivos (recurring public holidays) section of
 * /panel/availability — FestivosManager (components/panel/festivos-manager.tsx)
 * and the user-facing error messages from createFestivo/deleteClosure
 * (lib/actions/closures.ts). See workflows/holidays-and-time-off.md ->
 * recurring-public-holidays.
 */
export interface FestivosDictionary {
  title: string;
  dayLabel: string;
  monthLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  add: string; // "+ Añadir festivo" — collapsed trigger button that reveals the add form
  save: string; // "Guardar" — add form's submit button (once expanded)
  delete: string; // aria-label
  edit: string; // aria-label on the edit-pencil button
  saveEdit: string; // "Guardar cambios" — inline-edit form's submit button
  cancelEdit: string; // aria-label on the inline-edit form's cancel/X button
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

const es: FestivosDictionary = {
  title: "Festivos",
  dayLabel: "Día",
  monthLabel: "Mes",
  nameLabel: "Nombre (opcional)",
  namePlaceholder: "Ej. Navidad",
  add: "Añadir festivo",
  save: "Guardar",
  delete: "Eliminar festivo",
  edit: "Editar festivo",
  saveEdit: "Guardar cambios",
  cancelEdit: "Cancelar edición",
  errUnexpected: "Ocurrió un error inesperado. Inténtalo de nuevo.",
  errors: {
    errNoBusiness: "Primero configura tu negocio.",
    errSaveFailed: "No se pudo guardar:",
    errDeleteFailed: "No se pudo eliminar:",
    errInvalidRecurringDate: "La fecha del festivo no es válida.",
    errInvalidDateRange: "El rango de fechas no es válido.",
    errInvalidTimeRange: "El horario no es válido.",
    errLabelTooLong: "El nombre no puede superar los {max} caracteres.",
  },
};

const en: FestivosDictionary = {
  title: "Holidays",
  dayLabel: "Day",
  monthLabel: "Month",
  nameLabel: "Name (optional)",
  namePlaceholder: "E.g. Christmas",
  add: "Add holiday",
  save: "Save",
  delete: "Delete holiday",
  edit: "Edit holiday",
  saveEdit: "Save changes",
  cancelEdit: "Cancel editing",
  errUnexpected: "Something went wrong. Please try again.",
  errors: {
    errNoBusiness: "Set up your business first.",
    errSaveFailed: "Couldn't save:",
    errDeleteFailed: "Couldn't delete:",
    errInvalidRecurringDate: "That holiday date isn't valid.",
    errInvalidDateRange: "That date range isn't valid.",
    errInvalidTimeRange: "That time range isn't valid.",
    errLabelTooLong: "The name can't be longer than {max} characters.",
  },
};

const FESTIVOS_DICTIONARIES: Record<Locale, FestivosDictionary> = { es, en };

export function getFestivosDictionary(locale: Locale): FestivosDictionary {
  return FESTIVOS_DICTIONARIES[locale];
}
