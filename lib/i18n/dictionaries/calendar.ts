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
    tabClients: string;
    tabCancellations: string;
    tabConflicts: string; // conflicts-tab: live/derived closure-vs-booking overlaps
    filterAll: string; // "Todos" filter chip on the Clientes tab
    cancellationRequestedLabel: string; // the small badge on a cancellation-request row
    conflictMatchesTemplate: string; // "Coincide con: {closure}" — contains "{closure}"
    today: string;
    tomorrow: string;
    emptyClientsTitle: string;
    emptyCancellationsTitle: string;
    emptyConflictsTitle: string;
    loadingConflicts: string;
    emptyUpcomingTitle: string;
    emptySubtitle: string;
    cancel: string;
    confirm: string;
    confirming: string;
    markReviewed: string; // "Contactado / Confirmado" button on a guest_confirmed row
    markingReviewed: string;
    approveCancellation: string;
    denyCancellation: string;
    reviewing: string;
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
    errPaymentMethodRequired: string; // updateBookingResult — marking paid without a method
    errBonoLocked: string; // updateBookingResult — switching away from an applied bono
    errBonoNotFound: string; // updateBookingResult — chosen bono unavailable
  };
  week: {
    prevLabel: string; // aria-label for the "previous" nav button — same button for day/week/month
    nextLabel: string; // aria-label for the "next" nav button
    today: string; // "Hoy" jump-to-today button
    allProviders: string; // "Todos" filter option
    noProviders: string; // shown when a solo business has somehow no team member seeded
    // multi-provider-calendar-display (calendar-management-upcoming.md):
    // the persistent multi-select provider filter shared by Day/Week view.
    providerFilterLabel: string; // "Profesionales" — the filter dropdown's trigger button
    providerFilterAll: string; // "Todos" option inside the dropdown — clears the selection back to "all"
    addAppointment: string; // tooltip/aria-label on an empty slot
    weekRangeTemplate: string; // "{from} – {to}", {from}/{to} pre-formatted date strings
    viewDay: string; // Day/Week/Month dropdown option
    viewWeek: string;
    viewMonth: string;
    moreTemplate: string; // "+{n} más" overflow chip on a month-grid day cell, {n} replaced client-side
    // holidays-and-time-off (2026-09-26): shown under a day column's date
    // label, in parentheses, when that day is a recurring clinic-wide
    // festivo — the closure's own label, or this fallback when it has none.
    festivoFallbackLabel: string;
  };
  modal: {
    title: string; // "Nueva cita"
    editTitle: string; // "Modificar cita"
    serviceLabel: string;
    servicePlaceholder: string;
    providerLabel: string;
    // multi-provider-calendar-display: shown as the provider <select>'s
    // blank/unselected option in the merged Week view (more than one
    // provider active) — created from a day click that doesn't belong to
    // any one provider's column, so nothing is defaulted; required before
    // submit (submit button stays disabled, same pattern as service/date).
    providerPlaceholder: string;
    dateTimeLabel: string; // read-only summary shown above the fields (weekday + full date)
    dateLabel: string; // "Fecha" — editable date field
    timeLabel: string; // "Hora" — editable time field (combobox: dropdown + free typing)
    outsideHoursNote: string; // non-blocking note shown when the picked time falls outside business hours
    closureWarningNote: string; // non-blocking note shown when the picked date/time falls on a festivo or provider time off; "{label}" is replaced with the closure's name
    closureGenericLabel: string; // "{label}" fallback when the matched closure has no custom label
    clientNameLabel: string;
    clientNamePlaceholder: string;
    clientEmailLabel: string;
    clientEmailPlaceholder: string;
    clientPhoneLabel: string;
    clientPhonePlaceholder: string;
    notesLabel: string; // "Comentarios (opcional)"
    notesPlaceholder: string;
    sendEmailLabel: string; // checkbox: "Enviar confirmación por email"
    sendWhatsappLabel: string; // checkbox: "Enviar confirmación por WhatsApp" — only rendered when the business has WhatsApp booking enabled
    cancel: string;
    submit: string;
    submitting: string;
    saveButton: string; // "Guardar cambios" — edit mode's submit label
    saving: string; // "Guardando…" — edit mode's submitting label
    close: string; // aria-label for the X button
  };
  manualErrors: {
    // lib/actions/booking-owner.ts -> createBookingAsOwner / updateBookingAsOwner
    errNoBusiness: string;
    errInvalidService: string;
    errInvalidProvider: string;
    errNameRequired: string;
    errEmailInvalid: string;
    errInvalidSlot: string;
    errSlotTaken: string;
    errCreateFailed: string;
    errNotFound: string;
    errUpdateFailed: string;
  };
  detailModal: {
    close: string; // aria-label for the X button
    dismissButton: string; // "Cancelar" — closes the modal without saving (past bookings)
    notesLabel: string; // "Comentarios"
    modifyButton: string; // "Modificar" — opens the appointment editor (future bookings)
    cancelButton: string;
    cancelling: string;
    resultNoShow: string;
    resultCancelled: string;
    editPaymentButton: string; // "Editar" — small link next to a resolved Pago state (paid/no-show), reopens Cobrar/No-show
    // view-invoice-from-booking-modal: a separate "Factura" section below
    // Pago, shown once an invoice exists for the booking — its own
    // Descargar/Reenviar buttons, distinct from the Pago box so it never
    // reads as a payment-editing option.
    invoiceLabel: string; // "Factura"
    paymentLabel: string; // "Pago"
    paymentPaid: string;
    paymentPending: string;
    paymentMethodLabel: string; // "Método de pago" — inline selector shown once paymentPaid is chosen
    paymentMethodCash: string;
    paymentMethodCard: string;
    // payment-cancellation-flow-expansion: the expanded Cobrar method list
    // beyond cash/card — lib/booking/payment-methods.ts's PAYMENT_METHOD_CODES.
    paymentMethodBankTransfer: string;
    paymentMethodBizum: string;
    paymentMethodDirectDebit: string;
    paymentMethodPaypal: string;
    paymentMethodOther: string;
    paymentMethodBono: string; // generic short label ("Bono") used in the paid-summary line, no name/count
    paymentMethodBonoTemplate: string; // "{bonoName} ({n} restantes)" — one option per active bono
    paymentMethodLockedNote: string; // shown instead of the selector once a bono is already applied
    saveButton: string;
    saving: string;
    // cobrar-button-and-paid-at (calendar-management-past.md)
    cobrarButton: string; // "Caja" — shown instead of a payment toggle on an unpaid appointment (future or past)
    cobrarModalTitle: string;
    cobrarCancel: string; // closes the Cobrar modal without charging
    paidWithTemplate: string; // "Pagado con {method} · {time}" — {method} and {time} replaced client-side
    // payment-cancellation-flow-expansion: past-appointment "Cancelar
    // cita" — only offered for an UNRESOLVED past booking (still
    // pending_confirmation/confirmed, just its time has passed). A
    // future-appointment cancel keeps the plain confirm dialog, no reason.
    pastCancelButton: string; // same label as cancelButton, reused — kept separate in case the two ever need to diverge
    pastCancelModalTitle: string; // "Esta cita ya ha pasado. ¿Por qué se cancela?"
    pastCancelReasonScheduleError: string; // "Error de agenda"
    pastCancelReasonOther: string; // "Otro"
    pastCancelOtherPlaceholder: string;
    pastCancelBack: string; // "Volver"
    pastCancelConfirm: string; // "Confirmar cancelación"
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
    tabClients: "Clientes",
    tabCancellations: "Cancelaciones",
    tabConflicts: "Conflictos",
    filterAll: "Todos",
    cancellationRequestedLabel: "Cancelación solicitada",
    conflictMatchesTemplate: "Coincide con: {closure}",
    today: "Hoy",
    tomorrow: "Mañana",
    emptyClientsTitle: "No hay reservas próximas",
    emptyCancellationsTitle: "No hay solicitudes de cancelación",
    emptyConflictsTitle: "No hay conflictos con citas existentes",
    loadingConflicts: "Buscando conflictos…",
    emptyUpcomingTitle: "No tienes reservas próximas",
    emptySubtitle: "Las reservas de tu página aparecerán aquí.",
    cancel: "Cancelar",
    confirm: "Confirmar",
    confirming: "Confirmando…",
    markReviewed: "Contactado / Confirmado",
    markingReviewed: "Guardando…",
    approveCancellation: "Aprobar",
    denyCancellation: "Denegar",
    reviewing: "Guardando…",
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
    errPaymentMethodRequired: "Elige cómo se ha pagado (efectivo, tarjeta o bono).",
    errBonoLocked: "Este pago ya está aplicado a un bono. Para cambiarlo, ve a la página de Bonos.",
    errBonoNotFound: "El bono elegido ya no está disponible.",
  },
  week: {
    prevLabel: "Anterior",
    nextLabel: "Siguiente",
    today: "Hoy",
    allProviders: "Todos",
    providerFilterLabel: "Profesionales",
    providerFilterAll: "Todos",
    noProviders: "Añade a tu equipo en Equipo para ver la semana.",
    addAppointment: "Añadir cita",
    weekRangeTemplate: "{from} – {to}",
    festivoFallbackLabel: "Festivo",
    viewDay: "Día",
    viewWeek: "Semana",
    viewMonth: "Mes",
    moreTemplate: "+{n} más",
  },
  modal: {
    title: "Nueva cita",
    editTitle: "Modificar cita",
    serviceLabel: "Servicio",
    servicePlaceholder: "Elige un servicio",
    providerLabel: "Profesional",
    providerPlaceholder: "Elige un profesional",
    dateTimeLabel: "Fecha y hora",
    dateLabel: "Fecha",
    timeLabel: "Hora",
    outsideHoursNote: "Fuera de horario laboral",
    closureWarningNote: "Este día/horario está marcado como no disponible ({label}). Puedes crear la cita igualmente.",
    closureGenericLabel: "festivo o ausencia",
    clientNameLabel: "Nombre del cliente",
    clientNamePlaceholder: "Nombre y apellidos",
    clientEmailLabel: "Email (opcional)",
    clientEmailPlaceholder: "cliente@email.com",
    clientPhoneLabel: "Teléfono (opcional)",
    clientPhonePlaceholder: "600 000 000",
    notesLabel: "Comentarios (opcional)",
    notesPlaceholder: "Notas internas sobre la cita",
    sendEmailLabel: "Enviar confirmación por email",
    sendWhatsappLabel: "Enviar confirmación por WhatsApp",
    cancel: "Cancelar",
    submit: "Crear cita",
    submitting: "Creando…",
    saveButton: "Guardar cambios",
    saving: "Guardando…",
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
    errNotFound: "Reserva no encontrada.",
    errUpdateFailed: "No se pudo actualizar la cita. Inténtalo de nuevo.",
  },
  detailModal: {
    close: "Cerrar",
    dismissButton: "Cancelar",
    notesLabel: "Comentarios",
    modifyButton: "Modificar",
    cancelButton: "Cancelar cita",
    cancelling: "Cancelando…",
    resultNoShow: "No-show",
    resultCancelled: "Cancelada",
    editPaymentButton: "Editar",
    invoiceLabel: "Factura",
    paymentLabel: "Pago",
    paymentPaid: "Pagado",
    paymentPending: "Pendiente",
    paymentMethodLabel: "Método de pago",
    paymentMethodCash: "Efectivo",
    paymentMethodCard: "Tarjeta",
    paymentMethodBankTransfer: "Transferencia",
    paymentMethodBizum: "Bizum",
    paymentMethodDirectDebit: "Domiciliado",
    paymentMethodPaypal: "PayPal",
    paymentMethodOther: "Otro",
    paymentMethodBono: "Bono",
    paymentMethodBonoTemplate: "{bonoName} ({n} restantes)",
    paymentMethodLockedNote: "Este pago ya está aplicado a un bono. Para cambiarlo, ve a la página de Bonos.",
    saveButton: "Guardar",
    saving: "Guardando…",
    cobrarButton: "Caja",
    cobrarModalTitle: "¿Cómo ha pagado?",
    cobrarCancel: "Cancelar",
    paidWithTemplate: "Pagado con {method} · {time}",
    pastCancelButton: "Cancelar cita",
    pastCancelModalTitle: "Esta cita ya ha pasado. ¿Por qué se cancela?",
    pastCancelReasonScheduleError: "Error de agenda",
    pastCancelReasonOther: "Otro",
    pastCancelOtherPlaceholder: "Describe el motivo…",
    pastCancelBack: "Volver",
    pastCancelConfirm: "Confirmar cancelación",
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
    tabClients: "Clients",
    tabCancellations: "Cancellations",
    tabConflicts: "Conflicts",
    filterAll: "All",
    cancellationRequestedLabel: "Cancellation requested",
    conflictMatchesTemplate: "Matches: {closure}",
    today: "Today",
    tomorrow: "Tomorrow",
    emptyClientsTitle: "No upcoming bookings",
    emptyCancellationsTitle: "No cancellation requests",
    emptyConflictsTitle: "No conflicts with existing bookings",
    loadingConflicts: "Checking for conflicts…",
    emptyUpcomingTitle: "You have no upcoming bookings",
    emptySubtitle: "Bookings from your page will show up here.",
    cancel: "Cancel",
    confirm: "Confirm",
    confirming: "Confirming…",
    markReviewed: "Contacted / Confirmed",
    markingReviewed: "Saving…",
    approveCancellation: "Approve",
    denyCancellation: "Deny",
    reviewing: "Saving…",
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
    errPaymentMethodRequired: "Choose how it was paid (cash, card, or a bono).",
    errBonoLocked: "This payment is already applied to a bono. To change it, go to the Bonos page.",
    errBonoNotFound: "The chosen bono is no longer available.",
  },
  week: {
    prevLabel: "Previous",
    nextLabel: "Next",
    today: "Today",
    allProviders: "All",
    providerFilterLabel: "Providers",
    providerFilterAll: "All",
    noProviders: "Add team members under Team to see the week view.",
    addAppointment: "Add appointment",
    weekRangeTemplate: "{from} – {to}",
    viewDay: "Day",
    viewWeek: "Week",
    viewMonth: "Month",
    moreTemplate: "+{n} more",
    festivoFallbackLabel: "Holiday",
  },
  modal: {
    title: "New appointment",
    editTitle: "Modify appointment",
    serviceLabel: "Service",
    servicePlaceholder: "Choose a service",
    providerLabel: "Provider",
    providerPlaceholder: "Choose a provider",
    dateTimeLabel: "Date and time",
    dateLabel: "Date",
    timeLabel: "Time",
    outsideHoursNote: "Outside business hours",
    closureWarningNote: "This day/time is marked as unavailable ({label}). You can still create the appointment.",
    closureGenericLabel: "holiday or time off",
    clientNameLabel: "Client name",
    clientNamePlaceholder: "Full name",
    clientEmailLabel: "Email (optional)",
    clientEmailPlaceholder: "client@email.com",
    clientPhoneLabel: "Phone (optional)",
    clientPhonePlaceholder: "600 000 000",
    notesLabel: "Comments (optional)",
    notesPlaceholder: "Internal notes about the appointment",
    sendEmailLabel: "Send confirmation email",
    sendWhatsappLabel: "Send confirmation via WhatsApp",
    cancel: "Cancel",
    submit: "Create appointment",
    submitting: "Creating…",
    saveButton: "Save changes",
    saving: "Saving…",
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
    errNotFound: "Booking not found.",
    errUpdateFailed: "Couldn't update the appointment. Please try again.",
  },
  detailModal: {
    close: "Close",
    dismissButton: "Cancel",
    notesLabel: "Comments",
    modifyButton: "Modify",
    cancelButton: "Cancel appointment",
    cancelling: "Cancelling…",
    resultNoShow: "No-show",
    resultCancelled: "Cancelled",
    editPaymentButton: "Edit",
    invoiceLabel: "Invoice",
    paymentLabel: "Payment",
    paymentPaid: "Paid",
    paymentPending: "Pending",
    paymentMethodLabel: "Payment method",
    paymentMethodCash: "Cash",
    paymentMethodCard: "Card",
    paymentMethodBankTransfer: "Bank transfer",
    paymentMethodBizum: "Bizum",
    paymentMethodDirectDebit: "Direct debit",
    paymentMethodPaypal: "PayPal",
    paymentMethodOther: "Other",
    paymentMethodBono: "Bono",
    paymentMethodBonoTemplate: "{bonoName} ({n} left)",
    paymentMethodLockedNote: "This payment is already applied to a bono. To change it, go to the Bonos page.",
    saveButton: "Save",
    saving: "Saving…",
    cobrarButton: "Payment",
    cobrarModalTitle: "How did they pay?",
    cobrarCancel: "Cancel",
    paidWithTemplate: "Paid with {method} · {time}",
    pastCancelButton: "Cancel appointment",
    pastCancelModalTitle: "This appointment has already passed. Why is it being cancelled?",
    pastCancelReasonScheduleError: "Scheduling error",
    pastCancelReasonOther: "Other",
    pastCancelOtherPlaceholder: "Describe the reason…",
    pastCancelBack: "Back",
    pastCancelConfirm: "Confirm cancellation",
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
