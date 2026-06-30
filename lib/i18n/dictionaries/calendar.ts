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
    tabUpcoming: string;
    tabPending: string;
    pendingLabel: string; // the small badge on a pending booking row
    today: string;
    tomorrow: string;
    emptyPendingTitle: string;
    emptyUpcomingTitle: string;
    emptySubtitle: string;
    cancel: string;
    minutesUnit: string;
    errCancelFailed: string;
  };
  errors: {
    // lib/actions/booking-owner.ts
    errNoBusiness: string;
    errNotFound: string;
    errCannotCancel: string;
    errCancelFailed: string;
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
    tabUpcoming: "Próximas",
    tabPending: "Pendientes",
    pendingLabel: "Pendiente",
    today: "Hoy",
    tomorrow: "Mañana",
    emptyPendingTitle: "No hay reservas pendientes",
    emptyUpcomingTitle: "No tienes reservas próximas",
    emptySubtitle: "Las reservas de tu página aparecerán aquí.",
    cancel: "Cancelar",
    minutesUnit: "min",
    errCancelFailed: "No se pudo cancelar. Inténtalo de nuevo.",
  },
  errors: {
    errNoBusiness: "No hay negocio.",
    errNotFound: "Reserva no encontrada.",
    errCannotCancel: "Esta reserva ya no se puede cancelar.",
    errCancelFailed: "No se pudo cancelar la reserva.",
  },
  intlLocale: "es-ES",
};

const en: CalendarDictionary = {
  page: {
    title: "Calendar",
    subtitle: "Your upcoming bookings.",
  },
  manager: {
    tabUpcoming: "Upcoming",
    tabPending: "Pending",
    pendingLabel: "Pending",
    today: "Today",
    tomorrow: "Tomorrow",
    emptyPendingTitle: "No pending bookings",
    emptyUpcomingTitle: "You have no upcoming bookings",
    emptySubtitle: "Bookings from your page will show up here.",
    cancel: "Cancel",
    minutesUnit: "min",
    errCancelFailed: "Couldn't cancel. Please try again.",
  },
  errors: {
    errNoBusiness: "No business found.",
    errNotFound: "Booking not found.",
    errCannotCancel: "This booking can no longer be cancelled.",
    errCancelFailed: "Couldn't cancel the booking.",
  },
  intlLocale: "en-GB",
};

const CALENDAR_DICTIONARIES: Record<Locale, CalendarDictionary> = { es, en };

export function getCalendarDictionary(locale: Locale): CalendarDictionary {
  return CALENDAR_DICTIONARIES[locale];
}
