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
    signOut: string; // link shown next to the signed-in patient's name
    myAccount: string; // top-bar link for a signed-in patient, e.g. "Mi cuenta"
  };
  authModal: {
    close: string; // aria-label for the X button
    title: string; // "Completa tu reserva"
    advantagesHeading: string; // bold "Con Kalendar tienes estas ventajas" heading above the perks list
    perk1: string;
    perk2: string;
    perk3: string;
    joinOrLogin: string; // primary button: "Únete a Kalendar o inicia sesión"
    registerButton: string; // "Regístrate gratis"
    signInButton: string; // "Ya soy cliente, inicia sesión"
    or: string;
    continueAsGuest: string;
    guestNote: string; // "Si continúas como invitado, la clínica revisará tu solicitud en un plazo de 24 horas."
    confirmTitle: string; // "Confirmar reserva" (already-authenticated view)
    confirmButton: string;
    confirming: string;
    roleConfirmTitle: string;
    roleConfirmBody: string; // "Iniciar sesión añadirá el rol de cliente a tu cuenta. ¿Continuar?"
    roleConfirmYes: string;
    roleConfirmNo: string;
  };
  authForm: {
    loginTitle: string; // "Bienvenido de nuevo"
    loginSubtitle: string; // "Inicia sesión en tu cuenta de Kalendar."
    registerTitle: string; // "Crea tu cuenta gratis"
    emailPlaceholder: string;
    passwordPlaceholder: string; // "Contraseña (mín. 8 car.)"
    confirmPasswordPlaceholder: string; // "Repite la contraseña"
    namePlaceholder: string;
    continueGoogle: string;
    or: string;
    signIn: string;
    signingIn: string;
    forgotPasswordLink: string;
    createAccount: string;
    creatingAccount: string;
    noAccount: string; // "¿No tienes cuenta?"
    createFreeLink: string; // "Crear una gratis"
    haveAccount: string; // "¿Ya tienes cuenta?"
    signInLink: string; // "Inicia sesión"
    termsNote: string; // "Al continuar aceptas los términos y la política de privacidad de Kalendar."
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
    closed: string; // shown under a non-open weekday column, e.g. "Cerrado"
    yourDetails: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    phonePlaceholder: string;
    notesPlaceholder: string;
    bookButton: string;
    booking: string;
    doneTitle: string;      // authenticated: "Reserva confirmada"
    doneBody: string;       // authenticated: "Tu reserva está confirmada..."
    doneTitleGuest: string; // guest: "Solicitud enviada"
    doneBodyGuest: string;  // guest: "La clínica revisará tu solicitud..."
    doneFieldDate: string;
    doneFieldClinic: string;
    doneFieldAddress: string;
    doneFieldService: string;
    doneFieldProfessional: string;
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
    signOut: "Cerrar sesión",
    myAccount: "Mi cuenta",
  },
  authModal: {
    close: "Cerrar",
    title: "Completa tu reserva",
    advantagesHeading: "Con Kalendar tienes estas ventajas",
    perk1: "Consulta el estado de tus citas",
    perk2: "Recibe recordatorios automáticos",
    perk3: "Modifica o cancela tus citas fácilmente",
    joinOrLogin: "Únete a Kalendar o inicia sesión",
    registerButton: "Regístrate gratis",
    signInButton: "Ya soy cliente, inicia sesión",
    or: "o",
    continueAsGuest: "Continuar como invitado",
    guestNote: "Si continúas como invitado, la clínica revisará tu solicitud en un plazo de 24 horas.",
    confirmTitle: "Confirmar reserva",
    confirmButton: "Confirmar reserva",
    confirming: "Reservando…",
    roleConfirmTitle: "Un momento",
    roleConfirmBody: "Esta cuenta ya existe con otro tipo de acceso. Continuar añadirá el rol de cliente a tu cuenta. ¿Quieres continuar?",
    roleConfirmYes: "Sí, continuar",
    roleConfirmNo: "No, cancelar",
  },
  authForm: {
    loginTitle: "Inicia sesión en Kalendar",
    loginSubtitle: "Inicia sesión en tu cuenta de Kalendar.",
    registerTitle: "Únete a Kalendar",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Contraseña (mín. 8 car.)",
    confirmPasswordPlaceholder: "Repite la contraseña",
    namePlaceholder: "Nombre y apellido",
    continueGoogle: "Continuar con Google",
    or: "o",
    signIn: "Iniciar sesión",
    signingIn: "Accediendo…",
    forgotPasswordLink: "¿Olvidaste tu contraseña?",
    createAccount: "Crear cuenta",
    creatingAccount: "Creando cuenta…",
    noAccount: "¿No tienes cuenta?",
    createFreeLink: "Crear una gratis",
    haveAccount: "¿Ya tienes cuenta?",
    signInLink: "Inicia sesión",
    termsNote: "Al continuar aceptas los términos y la política de privacidad de Kalendar.",
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
    closed: "Cerrado",
    yourDetails: "Tus datos",
    namePlaceholder: "Nombre y apellido",
    emailPlaceholder: "Email",
    phonePlaceholder: "Teléfono (opcional)",
    notesPlaceholder: "Comentarios (opcional)",
    bookButton: "Reservar",
    booking: "Reservando…",
    doneTitle: "¡Reserva confirmada!",
    doneBody: "Tu reserva está confirmada. Te esperamos.",
    doneTitleGuest: "Solicitud enviada",
    doneBodyGuest: "La clínica revisará tu solicitud en las próximas 24 horas. Te enviaremos un email cuando sea confirmada.",
    doneFieldDate: "Fecha y hora",
    doneFieldClinic: "Clínica",
    doneFieldAddress: "Dirección",
    doneFieldService: "Tipo de cita",
    doneFieldProfessional: "Profesional",
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
    signOut: "Sign out",
    myAccount: "My account",
  },
  authModal: {
    close: "Close",
    title: "Complete your booking",
    advantagesHeading: "With Kalendar you get these advantages",
    perk1: "Check the status of your appointments",
    perk2: "Get automatic reminders",
    perk3: "Reschedule or cancel your appointments easily",
    joinOrLogin: "Join Kalendar or sign in",
    registerButton: "Sign up for free",
    signInButton: "Already a customer? Sign in",
    or: "or",
    continueAsGuest: "Continue as guest",
    guestNote: "If you continue as a guest, the clinic will review your request within 24 hours.",
    confirmTitle: "Confirm booking",
    confirmButton: "Confirm booking",
    confirming: "Booking…",
    roleConfirmTitle: "One moment",
    roleConfirmBody: "This account already exists with a different type of access. Continuing will add the client role to your account. Do you want to continue?",
    roleConfirmYes: "Yes, continue",
    roleConfirmNo: "No, cancel",
  },
  authForm: {
    loginTitle: "Sign in to Kalendar",
    loginSubtitle: "Sign in to your Kalendar account.",
    registerTitle: "Join Kalendar",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password (min. 8 char.)",
    confirmPasswordPlaceholder: "Repeat password",
    namePlaceholder: "First and last name",
    continueGoogle: "Continue with Google",
    or: "or",
    signIn: "Sign in",
    signingIn: "Signing in…",
    forgotPasswordLink: "Forgot your password?",
    createAccount: "Create account",
    creatingAccount: "Creating account…",
    noAccount: "Don't have an account?",
    createFreeLink: "Create one for free",
    haveAccount: "Already have an account?",
    signInLink: "Sign in",
    termsNote: "By continuing you accept Kalendar's terms and privacy policy.",
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
    closed: "Closed",
    yourDetails: "Your details",
    namePlaceholder: "First and last name",
    emailPlaceholder: "Email",
    phonePlaceholder: "Phone (optional)",
    notesPlaceholder: "Comments (optional)",
    bookButton: "Book",
    booking: "Booking…",
    doneTitle: "Booking confirmed!",
    doneBody: "Your booking is confirmed. See you soon.",
    doneTitleGuest: "Request sent",
    doneBodyGuest: "The clinic will review your request within 24 hours. We'll send you an email once it's confirmed.",
    doneFieldDate: "Date and time",
    doneFieldClinic: "Clinic",
    doneFieldAddress: "Address",
    doneFieldService: "Appointment type",
    doneFieldProfessional: "Professional",
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
