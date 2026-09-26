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
    welcome: string; // contains "{name}" — top-bar greeting for a signed-in patient, e.g. "Bienvenido, {name}"
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
    guestNote: string; // "Tu reserva quedará confirmada al momento, sin necesidad de crear una cuenta."
    confirmTitle: string; // "Confirmar reserva" (already-authenticated view)
    confirmButton: string;
    confirming: string;
    roleConfirmTitle: string;
    roleConfirmBodyPrefix: string; // informational — no self-service role add, explains the guest option + support
    roleConfirmBodySuffix: string;
    roleConfirmAction: string; // single button: continue this booking as a guest
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
    // Split into pieces (not one termsNote string) so "términos"/"privacidad"
    // can each link to their own page — matches the same pattern
    // signup-form.tsx/patient-login-form.tsx already use. Rendered as
    // "{prefix} {termsLink} {termsAnd} {privacyLink}{termsSuffix}" — note
    // NO space before termsSuffix in that render; each locale's suffix
    // supplies its own leading space if it needs one (Spanish does, " de
    // Kalendar."; English doesn't, just ".") so both read naturally
    // without hardcoding either language's punctuation/spacing rules into
    // the shared JSX.
    termsPrefix: string; // "Al continuar aceptas los"
    termsLink: string; // "términos"
    termsAnd: string; // "y la"
    privacyLink: string; // "política de privacidad"
    termsSuffix: string; // " de Kalendar." (leading space — see above)
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
    // holidays-and-time-off (2026-09-26): shown instead of noSlotsThisDay/closed
    // when the day is closed specifically for a recurring, clinic-wide festivo
    // (never for a one-off provider vacation/time-off — those keep the
    // generic messaging above). Contains "{name}", the festivo's own label
    // (or a generic fallback when it has none — see festivoFallbackLabel).
    closedFestivoTemplate: string;
    // Fallback used in place of "{name}" above when the festivo itself has
    // no label set.
    festivoFallbackLabel: string;
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
    priceOnRequestLabel: string;
    minutesUnit: string;
    errNameRequired: string;
    errEmailInvalid: string;
    // Step-progress bar labels (visible-progress-indicator) — chooseService/
    // chooseDateTime already exist and are reused as-is for consistency
    // (same word choice a guest already saw as a section heading); only the
    // short "Profesional"/"Confirmación" progress-bar-specific labels are
    // new — these are short chip labels, not full section headings, so
    // they're distinct from chooseProvider ("Elige profesional").
    progressProvider: string;
    progressConfirm: string;
    // Appointment summary recap (appointment-summary-recap)
    recapTitle: string; // e.g. "Resumen de tu cita"
    recapPrice: string;
    recapDate: string;
    recapTime: string;
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
    welcome: "Bienvenido, {name}",
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
    guestNote: "Tu reserva quedará confirmada al momento, sin necesidad de crear una cuenta.",
    confirmTitle: "Confirmar reserva",
    confirmButton: "Confirmar reserva",
    confirming: "Reservando…",
    roleConfirmTitle: "Esta cuenta ya existe como cuenta de clínica",
    roleConfirmBodyPrefix: "La cuenta",
    roleConfirmBodySuffix: "ya existe como cuenta de clínica. No es posible añadir el acceso de cliente a esta cuenta por tu cuenta. Puedes continuar esta reserva como invitado, sin necesidad de crear una cuenta. Si necesitas ambos tipos de acceso, contacta con soporte.",
    roleConfirmAction: "Continuar como invitado",
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
    termsPrefix: "Al continuar aceptas los",
    termsLink: "términos",
    termsAnd: "y la",
    privacyLink: "política de privacidad",
    // No leading space in JSX before this one (see booking-wizard.tsx's
    // render) — supplies its own, since English's needs none (just ".").
    termsSuffix: " de Kalendar.",
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
    closedFestivoTemplate: "Cerrado — {name}",
    festivoFallbackLabel: "Festivo",
    yourDetails: "Tus datos",
    namePlaceholder: "Nombre y apellido",
    emailPlaceholder: "Email",
    phonePlaceholder: "Teléfono (opcional)",
    notesPlaceholder: "Comentarios (opcional)",
    bookButton: "Reservar",
    booking: "Reservando…",
    doneTitle: "¡Reserva confirmada!",
    doneBody: "Tu reserva está confirmada. Te esperamos.",
    doneTitleGuest: "¡Reserva confirmada!",
    doneBodyGuest: "Tu reserva está confirmada. Te hemos enviado un email con los detalles.",
    doneFieldDate: "Fecha y hora",
    doneFieldClinic: "Clínica",
    doneFieldAddress: "Dirección",
    doneFieldService: "Tipo de cita",
    doneFieldProfessional: "Profesional",
    bookAnother: "Hacer otra reserva",
    priceOnRequestLabel: "Consultar precio",
    minutesUnit: "min",
    errNameRequired: "Indica tu nombre.",
    errEmailInvalid: "Indica un email válido.",
    progressProvider: "Profesional",
    progressConfirm: "Confirmación",
    recapTitle: "Resumen de tu cita",
    recapPrice: "Precio",
    recapDate: "Fecha",
    recapTime: "Hora",
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
    welcome: "Welcome, {name}",
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
    guestNote: "Your booking will be confirmed instantly, no account needed.",
    confirmTitle: "Confirm booking",
    confirmButton: "Confirm booking",
    confirming: "Booking…",
    roleConfirmTitle: "This account already exists as a clinic account",
    roleConfirmBodyPrefix: "The account",
    roleConfirmBodySuffix: "already exists as a clinic account. You can't add client access to it yourself. You can continue this booking as a guest, no account needed. If you need both types of access, contact support.",
    roleConfirmAction: "Continue as guest",
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
    termsPrefix: "By continuing you accept Kalendar's",
    termsLink: "terms",
    termsAnd: "and",
    privacyLink: "privacy policy",
    termsSuffix: ".",
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
    closedFestivoTemplate: "Closed — {name}",
    festivoFallbackLabel: "Holiday",
    yourDetails: "Your details",
    namePlaceholder: "First and last name",
    emailPlaceholder: "Email",
    phonePlaceholder: "Phone (optional)",
    notesPlaceholder: "Comments (optional)",
    bookButton: "Book",
    booking: "Booking…",
    doneTitle: "Booking confirmed!",
    doneBody: "Your booking is confirmed. See you soon.",
    doneTitleGuest: "Booking confirmed!",
    doneBodyGuest: "Your booking is confirmed. We've sent you an email with the details.",
    doneFieldDate: "Date and time",
    doneFieldClinic: "Clinic",
    doneFieldAddress: "Address",
    doneFieldService: "Appointment type",
    doneFieldProfessional: "Professional",
    bookAnother: "Make another booking",
    priceOnRequestLabel: "Price on request",
    minutesUnit: "min",
    errNameRequired: "Enter your name.",
    errEmailInvalid: "Enter a valid email.",
    progressProvider: "Professional",
    progressConfirm: "Confirm",
    recapTitle: "Your appointment summary",
    recapPrice: "Price",
    recapDate: "Date",
    recapTime: "Time",
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
