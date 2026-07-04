import type { Locale } from "../config";

/**
 * Dictionary for the public booking page (/bookings/[slug]): the page header,
 * BookingWizard and all its steps (service, provider, date/time, details,
 * done), and the user-facing error messages from getAvailableSlots +
 * submitBooking (lib/actions/booking.ts). This page is GUEST-facing, not
 * owner-facing: the language choice here is independent of the panel/home
 * cookie and does NOT persist across visits or businesses (component state
 * only, resets each visit) — each booking page is a separate, unrelated
 * context for the guest.
 *
 * INTERIM: this page currently always starts in Spanish, with a switcher the
 * guest can use to flip to English. FUTURE: once kalendar_businesses gets a
 * `language` field (see memory), the initial locale should come from the
 * business's chosen language instead of always defaulting to 'es' — the guest
 * switcher stays either way.
 */
export interface BookingPageDictionary {
  header: {
    poweredBy: string; // "Reservas con" — footer line before the Kalendar logo
  };
  wizard: {
    back: string;
    chooseService: string;
    noServices: string;
    chooseProvider: string;
    anyProvider: string;
    anyProviderSub: string;
    chooseDateTime: string;
    prevWeek: string; // aria-label
    nextWeek: string; // aria-label
    searchingSlots: string;
    noSlotsThisDay: string;
    yourDetails: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    phonePlaceholder: string;
    bookButton: string;
    booking: string;
    doneTitle: string;      // authenticated: "Reserva confirmada"
    doneBody: string;       // authenticated: "Tu reserva está confirmada..."
    doneTitleGuest: string; // guest: "Solicitud enviada"
    doneBodyGuest: string;  // guest: "La clínica revisará tu solicitud..."
    bookAnother: string;
    freeLabel: string;
    minutesUnit: string;
    errNameRequired: string;
    errEmailInvalid: string;
  };
  errors: {
    // lib/actions/booking.ts getAvailableSlots + submitBooking
    errBusinessUnavailable: string;
    errInvalidService: string;
    errInvalidDate: string;
    errNameRequired: string;
    errEmailInvalid: string;
    errInvalidSlot: string;
    errInvalidProvider: string;
    errSlotTaken: string;
    errCreateFailed: string;
  };
  // Date/calendar formatting (real LOGIC, not just labels — used for the week
  // navigator's month heading and the 7-day strip's weekday initials).
  months: string[]; // 12 entries, January..December
  weekdaysShort: string[]; // 7 entries, Monday-first (L M X J V S D style)
}

const es: BookingPageDictionary = {
  header: {
    poweredBy: "Reservas con",
  },
  wizard: {
    back: "Atrás",
    chooseService: "Elige un servicio",
    noServices: "Este negocio aún no tiene servicios disponibles.",
    chooseProvider: "Elige profesional",
    anyProvider: "Cualquiera",
    anyProviderSub: "Primer hueco disponible",
    chooseDateTime: "Elige fecha y hora",
    prevWeek: "Semana anterior",
    nextWeek: "Semana siguiente",
    searchingSlots: "Buscando horarios…",
    noSlotsThisDay: "No hay horarios disponibles este día.",
    yourDetails: "Tus datos",
    namePlaceholder: "Nombre y apellido",
    emailPlaceholder: "Email",
    phonePlaceholder: "Teléfono (opcional)",
    bookButton: "Reservar",
    booking: "Reservando…",
    doneTitle: "¡Reserva confirmada!",
    doneBody: "Tu reserva está confirmada. Te esperamos.",
    doneTitleGuest: "Solicitud enviada",
    doneBodyGuest: "La clínica revisará tu solicitud en las próximas 24 horas. Te enviaremos un email cuando sea confirmada.",
    bookAnother: "Hacer otra reserva",
    freeLabel: "Gratis",
    minutesUnit: "min",
    errNameRequired: "Indica tu nombre.",
    errEmailInvalid: "Indica un email válido.",
  },
  errors: {
    errBusinessUnavailable: "Negocio no disponible.",
    errInvalidService: "Servicio no válido.",
    errInvalidDate: "Fecha no válida.",
    errNameRequired: "Indica tu nombre.",
    errEmailInvalid: "Indica un email válido.",
    errInvalidSlot: "La hora seleccionada no es válida.",
    errInvalidProvider: "Profesional no válido.",
    errSlotTaken: "Ese horario ya no está disponible. Elige otro.",
    errCreateFailed: "No se pudo crear la reserva. Inténtalo de nuevo.",
  },
  months: [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ],
  weekdaysShort: ["L", "M", "X", "J", "V", "S", "D"],
};

const en: BookingPageDictionary = {
  header: {
    poweredBy: "Booking by",
  },
  wizard: {
    back: "Back",
    chooseService: "Choose a service",
    noServices: "This business doesn't have any services available yet.",
    chooseProvider: "Choose a professional",
    anyProvider: "Anyone",
    anyProviderSub: "First available slot",
    chooseDateTime: "Choose date and time",
    prevWeek: "Previous week",
    nextWeek: "Next week",
    searchingSlots: "Looking for times…",
    noSlotsThisDay: "No times available this day.",
    yourDetails: "Your details",
    namePlaceholder: "First and last name",
    emailPlaceholder: "Email",
    phonePlaceholder: "Phone (optional)",
    bookButton: "Book",
    booking: "Booking…",
    doneTitle: "Booking confirmed!",
    doneBody: "Your booking is confirmed. See you soon.",
    doneTitleGuest: "Request sent",
    doneBodyGuest: "The clinic will review your request within 24 hours. We'll send you an email once it's confirmed.",
    bookAnother: "Make another booking",
    freeLabel: "Free",
    minutesUnit: "min",
    errNameRequired: "Enter your name.",
    errEmailInvalid: "Enter a valid email.",
  },
  errors: {
    errBusinessUnavailable: "Business unavailable.",
    errInvalidService: "Invalid service.",
    errInvalidDate: "Invalid date.",
    errNameRequired: "Enter your name.",
    errEmailInvalid: "Enter a valid email.",
    errInvalidSlot: "The selected time is no longer valid.",
    errInvalidProvider: "Invalid professional.",
    errSlotTaken: "That time is no longer available. Please choose another.",
    errCreateFailed: "Couldn't create the booking. Please try again.",
  },
  months: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  weekdaysShort: ["M", "T", "W", "T", "F", "S", "S"],
};

const BOOKING_PAGE_DICTIONARIES: Record<Locale, BookingPageDictionary> = { es, en };

export function getBookingPageDictionary(locale: Locale): BookingPageDictionary {
  return BOOKING_PAGE_DICTIONARIES[locale];
}
