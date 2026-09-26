import type { Locale } from "../config";

/**
 * Dictionary for the shared closure-conflict confirmation dialog
 * (components/panel/closure-conflict-dialog.tsx) — used by both
 * FestivosManager and TimeOffList when createFestivo/createTimeOff report
 * existing bookings would be affected. See
 * workflows/holidays-and-time-off.md -> existing-bookings-conflict-alert.
 */
export interface ClosureConflictDictionary {
  title: string; // contains "{count}"
  description: string;
  moreLabel: string; // contains "{n}" — "+{n} more"
  cancel: string;
  confirm: string;
  saving: string;
}

const es: ClosureConflictDictionary = {
  title: "⚠️ {count} citas se ven afectadas",
  description:
    "Estas citas ya reservadas caen dentro del cierre que quieres guardar. No se cancelarán ni modificarán automáticamente — tendrás que contactar a los clientes tú mismo si es necesario.",
  moreLabel: "+{n} más",
  cancel: "Cancelar",
  confirm: "Guardar de todas formas",
  saving: "Guardando...",
};

const en: ClosureConflictDictionary = {
  title: "⚠️ {count} appointments affected",
  description:
    "These already-booked appointments fall inside the closure you're about to save. They won't be cancelled or changed automatically — you'll need to reach out to the clients yourself if needed.",
  moreLabel: "+{n} more",
  cancel: "Cancel",
  confirm: "Save anyway",
  saving: "Saving...",
};

const CLOSURE_CONFLICT_DICTIONARIES: Record<Locale, ClosureConflictDictionary> = { es, en };

export function getClosureConflictDictionary(locale: Locale): ClosureConflictDictionary {
  return CLOSURE_CONFLICT_DICTIONARIES[locale];
}
