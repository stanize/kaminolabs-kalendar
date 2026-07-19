import type { Locale } from "../config";

/**
 * Dictionary for the Calendario (calendar) panel page: the page itself,
 * CalendarBookings (tabs, day grouping, booking rows, empty states), and the
 * user-facing error messages from lib/actions/booking-owner.ts. The
 * Intl.DateTimeFormat locale tag used for day headings (e.g. "martes, 15 de
 * julio") also lives here, since it's tied 1:1 to this page's display needs.
 */
export interface CalendarDictionary {
  page: {
    title: string;
    subtitle: string;
  };
  manager: {
    tabWeek: string;
    tabUpcoming: string;
    tabPending: string;
    pendingLabel: string; // the small badge on a pending booking row
    today: string;
    tomorrow: string;
    emptyPendingTitle: string;
    emptyUpcomingTitle: string;
    emptySubtitle: string;
    cancel: string;
    confirm: string;
    confirming: string;
    minutesUnit: string;
    errCancelFailed: string;
    expiresIn: string; // e.g. "Caduca en {h}h {m}m" — {h} and {m} replaced client-side
    expired: string;
  };
  errors: {
    // lib/actions/booking-owner.ts
    errNoBusiness: string;
    errNotFound: string;
    errCannotCancel: string;
    errCancelFailed: string;
    errUpdateFailed: string; // updateBookingResult
  };
  week: {
    prevLabel: string; // aria-label for the "previous" nav button — same button for day/week/month
    nextLabel: string; // aria-label for the "next" nav button
    today: string; // "Hoy" jump-to-today button
    allProviders: string; // "Todos" filter option
    noProviders: string; // shown when a solo business has somehow no team member seeded
    addAppointment: string; // tooltip/aria-label on an empty slot
    weekRangeTemplate: string; // "{from} – {to}", {from}/{to} pre-formatted date strings
    viewDay: string; // Day/Week/Month dropdown option
    viewWeek: string;
    viewMonth: string;
    moreTemplate: string; // "+{n} más" overflow chip on a month-grid day cell, {n} replaced client-side
  };
  modal: {
    title: string; // "Nueva cita"
    serviceLabel: string;
    servicePlaceholder: string;
    providerLabel: string;
    dateTimeLabel: string; // read-only summary of the clicked slot
    clientNameLabel: string;
    clientNamePlaceholder: string;
    clientEmailLabel: string;
    clientEmailPlaceholder: string;
    clientPhoneLabel: string;
    clientPhonePlaceholder: string;
    sendEmailLabel: string; // checkbox: "Enviar confirmación por email"
    cancel: string;
    submit: string;
    submitting: string;
    close: string; // aria-label for the X button
  };
  manualErrors: {
    // lib/actions/booking-owner.ts -> createBookingAsOwner
    errNoBusiness: string;
    errInvalidService: string;
    errInvalidProvider: string;
    errNameRequired: string;
    errEmailInvalid: string;
    errInvalidSlot: string;
    errSlotTaken: string;
    errCreateFailed: string;
  };
  detailModal: {
    close: string; // aria-label for the X button
    cancelButton: string;
    cancelling: string;
    resultLabel: string; // "Resultado"
    resultCompleted: string;
    resultNoShow: string;
    resultCancelled: string;
    paymentLabel: string; // "Pago"
    paymentPaid: string;
    paymentPending: string;
    saveButton: string;
    saving: string;
  };
  widget: {
    title: string; // "Hoy"
    appointmentsLabel: string; // "Citas"
    nextOpenTitle: string; // "Próxima apertura" — shown instead of "Hoy" once today has no time left
    weekTitle: string; // "Esta semana"
    nextWeekTitle: string; // "Próxima semana" — shown once this week has no time left
  };
  // Intl.DateTimeFormat locale tag for day-heading formatting (e.g. "es-ES").
  intlLocale: string;
}

const es: CalendarDictionary = {
  page: {
    title: "Calendario",
    subtitle: "Tus próximas reservas.",
  },
  manager: {
    tabWeek: "Semana",
    tabUpcoming: "Próximas",
    tabPending: "Pendientes",
    pendingLabel: "Pendiente",
    today: "Hoy",
    tomorrow: "Mañana",
    emptyPendingTitle: "No hay reservas pendientes",
    emptyUpcomingTitle: "No tienes reservas próximas",
    emptySubtitle: "Las reservas de tu página aparecerán aquí.",
    cancel: "Cancelar",
    confirm: "Confirmar",
    confirming: "Confirmando…",
    minutesUnit: "min",
    errCancelFailed: "No se pudo cancelar. Inténtalo de nuevo.",
    expiresIn: "Caduca en {h}h {m}m",
    expired: "Caducada",
  },
  errors: {
    errNoBusiness: "No hay negocio.",
    errNotFound: "Reserva no encontrada.",
    errCannotCancel: "Esta reserva ya no se puede cancelar.",
    errCancelFailed: "No se pudo cancelar la reserva.",
    errUpdateFailed: "No se pudo actualizar la cita.",
  },
  week: {
    prevLabel: "Anterior",
    nextLabel: "Siguiente",
    today: "Hoy",
    allProviders: "Todos",
    noProviders: "Añade a tu equipo en Equipo para ver la semana.",
    addAppointment: "Añadir cita",
    weekRangeTemplate: "{from} – {to}",
    viewDay: "Día",
    viewWeek: "Semana",
    viewMonth: "Mes",
    moreTemplate: "+{n} más",
  },
  modal: {
    title: "Nueva cita",
    serviceLabel: "Servicio",
    servicePlaceholder: "Elige un servicio",
    providerLabel: "Profesional",
    dateTimeLabel: "Fecha y hora",
    clientNameLabel: "Nombre del cliente",
    clientNamePlaceholder: "Nombre y apellidos",
    clientEmailLabel: "Email (opcional)",
    clientEmailPlaceholder: "cliente@email.com",
    clientPhoneLabel: "Teléfono (opcional)",
    clientPhonePlaceholder: "600 000 000",
    sendEmailLabel: "Enviar confirmación por email",
    cancel: "Cancelar",
    submit: "Crear cita",
    submitting: "Creando…",
    close: "Cerrar",
  },
  manualErrors: {
    errNoBusiness: "No hay negocio.",
    errInvalidService: "Servicio no válido.",
    errInvalidProvider: "Profesional no válido.",
    errNameRequired: "Indica el nombre del cliente.",
    errEmailInvalid: "Indica un email válido.",
    errInvalidSlot: "La hora seleccionada no es válida.",
    errSlotTaken: "Ese horario ya no está disponible. Elige otro.",
    errCreateFailed: "No se pudo crear la cita. Inténtalo de nuevo.",
  },
  detailModal: {
    close: "Cerrar",
    cancelButton: "Cancelar cita",
    cancelling: "Cancelando…",
    resultLabel: "Resultado",
    resultCompleted: "Completada",
    resultNoShow: "No-show",
    resultCancelled: "Cancelada",
    paymentLabel: "Pago",
    paymentPaid: "Pagado",
    paymentPending: "Pendiente",
    saveButton: "Guardar",
    saving: "Guardando…",
  },
  widget: {
    title: "Hoy",
    appointmentsLabel: "Citas",
    nextOpenTitle: "Próxima apertura",
    weekTitle: "Esta semana",
    nextWeekTitle: "Próxima semana",
  },
  intlLocale: "es-ES",
};

const en: CalendarDictionary = {
  page: {
    title: "Calendar",
    subtitle: "Your upcoming bookings.",
  },
  manager: {
    tabWeek: "Week",
    tabUpcoming: "Upcoming",
    tabPending: "Pending",
    pendingLabel: "Pending",
    today: "Today",
    tomorrow: "Tomorrow",
    emptyPendingTitle: "No pending bookings",
    emptyUpcomingTitle: "You have no upcoming bookings",
    emptySubtitle: "Bookings from your page will show up here.",
    cancel: "Cancel",
    confirm: "Confirm",
    confirming: "Confirming…",
    minutesUnit: "min",
    errCancelFailed: "Couldn't cancel. Please try again.",
    expiresIn: "Expires in {h}h {m}m",
    expired: "Expired",
  },
  errors: {
    errNoBusiness: "No business found.",
    errNotFound: "Booking not found.",
    errCannotCancel: "This booking can no longer be cancelled.",
    errCancelFailed: "Couldn't cancel the booking.",
    errUpdateFailed: "Couldn't update the appointment.",
  },
  week: {
    prevLabel: "Previous",
    nextLabel: "Next",
    today: "Today",
    allProviders: "All",
    noProviders: "Add team members under Team to see the week view.",
    addAppointment: "Add appointment",
    weekRangeTemplate: "{from} – {to}",
    viewDay: "Day",
    viewWeek: "Week",
    viewMonth: "Month",
    moreTemplate: "+{n} more",
  },
  modal: {
    title: "New appointment",
    serviceLabel: "Service",
    servicePlaceholder: "Choose a service",
    providerLabel: "Provider",
    dateTimeLabel: "Date and time",
    clientNameLabel: "Client name",
    clientNamePlaceholder: "Full name",
    clientEmailLabel: "Email (optional)",
    clientEmailPlaceholder: "client@email.com",
    clientPhoneLabel: "Phone (optional)",
    clientPhonePlaceholder: "600 000 000",
    sendEmailLabel: "Send confirmation email",
    cancel: "Cancel",
    submit: "Create appointment",
    submitting: "Creating…",
    close: "Close",
  },
  manualErrors: {
    errNoBusiness: "No business found.",
    errInvalidService: "Invalid service.",
    errInvalidProvider: "Invalid provider.",
    errNameRequired: "Enter the client's name.",
    errEmailInvalid: "Enter a valid email.",
    errInvalidSlot: "The selected time isn't valid.",
    errSlotTaken: "That slot is no longer available. Pick another.",
    errCreateFailed: "Couldn't create the appointment. Please try again.",
  },
  detailModal: {
    close: "Close",
    cancelButton: "Cancel appointment",
    cancelling: "Cancelling…",
    resultLabel: "Result",
    resultCompleted: "Completed",
    resultNoShow: "No-show",
    resultCancelled: "Cancelled",
    paymentLabel: "Payment",
    paymentPaid: "Paid",
    paymentPending: "Pending",
    saveButton: "Save",
    saving: "Saving…",
  },
  widget: {
    title: "Today",
    appointmentsLabel: "Appointments",
    nextOpenTitle: "Next opening",
    weekTitle: "This week",
    nextWeekTitle: "Next week",
  },
  intlLocale: "en-GB",
};

const CALENDAR_DICTIONARIES: Record<Locale, CalendarDictionary> = { es, en };

export function getCalendarDictionary(locale: Locale): CalendarDictionary {
  return CALENDAR_DICTIONARIES[locale];
}
