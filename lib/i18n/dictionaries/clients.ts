import type { Locale } from "../config";

export interface ClientsDictionary {
  list: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptySubtitle: string;
    noResults: string;
    sessionsUnit: string; // "citas" — one session/appointment
    lastVisit: string; // contains "{date}"
    noVisitYet: string;
  };
  detail: {
    back: string;
    notFound: string;
    upcomingTitle: string;
    historyTitle: string;
    emptyUpcoming: string;
    emptyHistory: string;
    statsTitle: string;
    totalSessions: string;
    completed: string;
    noShow: string;
    cancelled: string;
    firstVisit: string;
    lastVisit: string;
    never: string;
    contactTitle: string;
    nameLabel: string;
    emailLabel: string;
    phoneLabel: string;
    edit: string;
    save: string;
    saving: string;
    saved: string;
    cancel: string;
    notesTitle: string;
    notesPlaceholder: string;
    addNote: string;
    saveNote: string;
    editNote: string;
    deleteNote: string;
    confirmDeleteNote: string;
    emptyNotes: string;
    statusPending: string;
    statusConfirmed: string;
    statusCompleted: string;
    statusNoShow: string;
    statusCancelled: string;
    minutesUnit: string;
  };
  errors: {
    errNoBusiness: string;
    errNotFound: string;
    errNameRequired: string;
    errSaveFailed: string;
  };
}

const es: ClientsDictionary = {
  list: {
    title: "Clientes",
    subtitle: "Todas las personas que han reservado contigo.",
    searchPlaceholder: "Buscar por nombre, email o teléfono...",
    emptyTitle: "Todavía no tienes clientes",
    emptySubtitle: "Aparecerán aquí en cuanto alguien reserve una cita.",
    noResults: "No se encontraron clientes.",
    sessionsUnit: "citas",
    lastVisit: "Última visita: {date}",
    noVisitYet: "Sin visitas todavía",
  },
  detail: {
    back: "Clientes",
    notFound: "Cliente no encontrado.",
    upcomingTitle: "Próximas citas",
    historyTitle: "Historial",
    emptyUpcoming: "No tiene citas próximas.",
    emptyHistory: "Todavía no hay historial.",
    statsTitle: "Resumen",
    totalSessions: "Citas totales",
    completed: "Completadas",
    noShow: "No-show",
    cancelled: "Canceladas",
    firstVisit: "Primera visita",
    lastVisit: "Última visita",
    never: "—",
    contactTitle: "Contacto",
    nameLabel: "Nombre",
    emailLabel: "Email",
    phoneLabel: "Teléfono",
    edit: "Editar",
    save: "Guardar",
    saving: "Guardando…",
    saved: "Guardado.",
    cancel: "Cancelar",
    notesTitle: "Notas privadas",
    notesPlaceholder: "Escribe una nota sobre este cliente...",
    addNote: "Añadir nota",
    saveNote: "Guardar nota",
    editNote: "Editar",
    deleteNote: "Eliminar",
    confirmDeleteNote: "¿Eliminar esta nota?",
    emptyNotes: "No hay notas todavía. Solo tú y tu equipo podéis verlas.",
    statusPending: "Pendiente",
    statusConfirmed: "Confirmada",
    statusCompleted: "Completada",
    statusNoShow: "No-show",
    statusCancelled: "Cancelada",
    minutesUnit: "min",
  },
  errors: {
    errNoBusiness: "No hay negocio.",
    errNotFound: "Cliente no encontrado.",
    errNameRequired: "Indica el nombre del cliente.",
    errSaveFailed: "No se pudo guardar el cambio.",
  },
};

const en: ClientsDictionary = {
  list: {
    title: "Clients",
    subtitle: "Everyone who's booked with you.",
    searchPlaceholder: "Search by name, email, or phone...",
    emptyTitle: "No clients yet",
    emptySubtitle: "They'll show up here as soon as someone books an appointment.",
    noResults: "No clients found.",
    sessionsUnit: "sessions",
    lastVisit: "Last visit: {date}",
    noVisitYet: "No visits yet",
  },
  detail: {
    back: "Clients",
    notFound: "Client not found.",
    upcomingTitle: "Upcoming appointments",
    historyTitle: "History",
    emptyUpcoming: "No upcoming appointments.",
    emptyHistory: "No history yet.",
    statsTitle: "Summary",
    totalSessions: "Total sessions",
    completed: "Completed",
    noShow: "No-shows",
    cancelled: "Cancelled",
    firstVisit: "First visit",
    lastVisit: "Last visit",
    never: "—",
    contactTitle: "Contact",
    nameLabel: "Name",
    emailLabel: "Email",
    phoneLabel: "Phone",
    edit: "Edit",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    cancel: "Cancel",
    notesTitle: "Private notes",
    notesPlaceholder: "Write a note about this client...",
    addNote: "Add note",
    saveNote: "Save note",
    editNote: "Edit",
    deleteNote: "Delete",
    confirmDeleteNote: "Delete this note?",
    emptyNotes: "No notes yet. Only you and your team can see these.",
    statusPending: "Pending",
    statusConfirmed: "Confirmed",
    statusCompleted: "Completed",
    statusNoShow: "No-show",
    statusCancelled: "Cancelled",
    minutesUnit: "min",
  },
  errors: {
    errNoBusiness: "No business found.",
    errNotFound: "Client not found.",
    errNameRequired: "Enter the client's name.",
    errSaveFailed: "Couldn't save the change.",
  },
};

const CLIENTS_DICTIONARIES: Record<Locale, ClientsDictionary> = { es, en };

export function getClientsDictionary(locale: Locale): ClientsDictionary {
  return CLIENTS_DICTIONARIES[locale];
}
