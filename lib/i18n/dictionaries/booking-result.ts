import type { Locale } from "../config";

/**
 * Dictionary for the standalone /bookings/confirm/[token] and
 * /bookings/cancel/[token] pages, reached only via email links. Unlike the
 * main booking page, these have no switcher of their own — the language is
 * READ from the booking's stored guest_locale (the language the guest was
 * using when they originally booked) rather than chosen fresh on each visit.
 */
export interface BookingResultDictionary {
  confirm: {
    alreadyTitle: string;
    alreadyBody: string;
    successTitle: string;
    successBody: string;
    failTitle: string;
  };
  cancel: {
    notFoundTitle: string;
    alreadyTitle: string;
    alreadyBody: string;
    tooLateTitle: string;
    tooLateBody: string;
    confirmTitle: string;
    confirmButton: string;
    cancelling: string;
    doneTitle: string;
    doneBody: string;
    errUnexpected: string;
  };
}

const es: BookingResultDictionary = {
  confirm: {
    alreadyTitle: "Reserva ya confirmada",
    alreadyBody: "Esta reserva ya estaba confirmada. Te esperamos.",
    successTitle: "¡Reserva confirmada!",
    successBody: "Tu reserva está confirmada. Te esperamos.",
    failTitle: "No se pudo confirmar",
  },
  cancel: {
    notFoundTitle: "Reserva no encontrada",
    alreadyTitle: "Reserva ya cancelada",
    alreadyBody: "Esta reserva ya estaba cancelada.",
    tooLateTitle: "No se puede cancelar",
    tooLateBody: "Esta reserva ya no se puede cancelar.",
    confirmTitle: "¿Cancelar tu reserva?",
    confirmButton: "Sí, cancelar reserva",
    cancelling: "Cancelando…",
    doneTitle: "Reserva cancelada",
    doneBody: "Hemos cancelado tu reserva.",
    errUnexpected: "No se pudo cancelar. Inténtalo de nuevo.",
  },
};

const en: BookingResultDictionary = {
  confirm: {
    alreadyTitle: "Booking already confirmed",
    alreadyBody: "This booking was already confirmed. See you soon.",
    successTitle: "Booking confirmed!",
    successBody: "Your booking is confirmed. See you soon.",
    failTitle: "Couldn't confirm",
  },
  cancel: {
    notFoundTitle: "Booking not found",
    alreadyTitle: "Booking already cancelled",
    alreadyBody: "This booking was already cancelled.",
    tooLateTitle: "Can't be cancelled",
    tooLateBody: "This booking can no longer be cancelled.",
    confirmTitle: "Cancel your booking?",
    confirmButton: "Yes, cancel booking",
    cancelling: "Cancelling…",
    doneTitle: "Booking cancelled",
    doneBody: "We've cancelled your booking.",
    errUnexpected: "Couldn't cancel. Please try again.",
  },
};

const BOOKING_RESULT_DICTIONARIES: Record<Locale, BookingResultDictionary> = { es, en };

export function getBookingResultDictionary(locale: Locale): BookingResultDictionary {
  return BOOKING_RESULT_DICTIONARIES[locale];
}
