import type { Locale } from "../config";

/**
 * Dictionary for panel "shell" content — things that appear on every panel
 * page regardless of which one: the sidebar nav, the Inicio (home) page and
 * its setup checklist, the setup-complete banner, and the email verification
 * gate. Individual panel pages (Negocio, Servicios, Equipo, Disponibilidad,
 * Calendario, ...) each get their OWN dictionary file instead — see
 * lib/i18n/dictionaries/<page>.ts — since they don't share much vocabulary.
 *
 * The Inicio checklist items ("Configura tu negocio", etc.) live HERE, not in
 * each target page's own dictionary: they are content of the Inicio page
 * itself (a list shown on one screen), even though each item links onward to
 * a different page.
 */
export interface PanelShellDictionary {
  sidebar: {
    home: string;
    calendar: string;
    clients: string;
    business: string;
    services: string;
    team: string;
    availability: string;
    payments: string;
    invoices: string;
    notifications: string;
    reports: string;
    integrations: string;
    settings: string;
    support: string;
    signOut: string;
  };
  home: {
    greetingPrefix: string; // "Hola, " / "Hi, " — client appends the name
    greetingFallback: string;
    greetingEditHint: string;
    greetingErrRequired: string;
    greetingErrTooLong: string;
    greetingErrSaveFailed: string;
    subtitle: string;
    setupCardTitle: string;
    step1Label: string;
    step1Sub: string;
    step2Label: string;
    step2Sub: string;
    step3Label: string;
    step3Sub: string;
    step4Label: string;
    step4Sub: string;
    setupComplete: string;
    setupCompleteSub: string;
    bookingPageTitle: string;
    viewPage: string;
    downloadQr: string; // "Descargar código QR" button on the booking-page tile
    quickAccess: string;
  };
  verification: {
    title: string;
    bodyPrefix: string;
    bodySuffix: string;
    confirmedButton: string;
    checking: string;
    resend: string;
    resendCountdownTemplate: string; // contains "{seconds}", replaced client-side
    resending: string;
    notYet: string;
    resent: string;
    resendError: string;
    signOut: string;
  };
  roleUpgrade: {
    title: string;
    body: string;
    yes: string;
    no: string;
  };
}

const es: PanelShellDictionary = {
  sidebar: {
    home: "Inicio",
    calendar: "Calendario",
    clients: "Clientes",
    business: "Negocio",
    services: "Servicios",
    team: "Equipo",
    availability: "Disponibilidad",
    payments: "Pagos",
    invoices: "Facturas",
    notifications: "Emails y avisos",
    reports: "Informes",
    integrations: "Integraciones",
    settings: "Ajustes",
    support: "Soporte",
    signOut: "Cerrar sesión",
  },
  home: {
    greetingPrefix: "Hola, ",
    greetingFallback: "Inicio",
    greetingEditHint: "Haz clic para cambiar cómo te llamamos",
    greetingErrRequired: "Escribe un nombre.",
    greetingErrTooLong: "El nombre es demasiado largo.",
    greetingErrSaveFailed: "No se pudo guardar el nombre. Inténtalo de nuevo.",
    subtitle: "Bienvenido a tu panel de Kalendar.",
    setupCardTitle: "Configura tu página de reservas",
    step1Label: "Configura tu negocio",
    step1Sub: "Nombre, tipo y ciudad",
    step2Label: "Crea tus servicios",
    step2Sub: "Lo que tus clientes podrán reservar",
    step3Label: "Añade tu equipo",
    step3Sub: "Tú y las personas que trabajan contigo",
    step4Label: "Define tu disponibilidad",
    step4Sub: "Los días y horas en que aceptas citas",
    setupComplete: "¡Todo configurado!",
    setupCompleteSub: "Tu página de reservas está lista para recibir clientes.",
    bookingPageTitle: "Tu página de reservas",
    viewPage: "Ver página",
    downloadQr: "Descargar código QR",
    quickAccess: "Accesos rápidos",
  },
  verification: {
    title: "Confirma tu email",
    bodyPrefix: "Hemos enviado un enlace de confirmación a",
    bodySuffix: "Ábrelo para activar tu cuenta y empezar a usar Kalendar.",
    confirmedButton: "Ya he confirmado mi email",
    checking: "Comprobando…",
    resend: "Reenviar enlace",
    resendCountdownTemplate: "Reenviar enlace ({seconds}s)",
    resending: "Enviando…",
    notYet: "Todavía no detectamos la confirmación. Revisa tu correo (y la carpeta de spam) y vuelve a intentarlo.",
    resent: "Te hemos reenviado el enlace de confirmación.",
    resendError: "No se pudo reenviar el enlace. Inténtalo de nuevo en un momento.",
    signOut: "Cerrar sesión",
  },
  roleUpgrade: {
    title: "Un momento",
    body: "Esta cuenta ya existe como cuenta de cliente. Continuar añadirá el rol de clínica a tu cuenta. ¿Quieres continuar?",
    yes: "Sí, continuar",
    no: "No, volver a mi cuenta de cliente",
  },
};

const en: PanelShellDictionary = {
  sidebar: {
    home: "Home",
    calendar: "Calendar",
    clients: "Clients",
    business: "Business",
    services: "Services",
    team: "Team",
    availability: "Availability",
    payments: "Payments",
    invoices: "Invoices",
    notifications: "Emails & notifications",
    reports: "Reports",
    integrations: "Integrations",
    settings: "Settings",
    support: "Support",
    signOut: "Sign out",
  },
  home: {
    greetingPrefix: "Hi, ",
    greetingFallback: "Home",
    greetingEditHint: "Click to change how we greet you",
    greetingErrRequired: "Enter a name.",
    greetingErrTooLong: "That name is too long.",
    greetingErrSaveFailed: "Couldn't save the name. Please try again.",
    subtitle: "Welcome to your Kalendar dashboard.",
    setupCardTitle: "Set up your booking page",
    step1Label: "Set up your business",
    step1Sub: "Name, type, and city",
    step2Label: "Create your services",
    step2Sub: "What your clients will be able to book",
    step3Label: "Add your team",
    step3Sub: "You and the people who work with you",
    step4Label: "Set your availability",
    step4Sub: "The days and hours you accept appointments",
    setupComplete: "All set!",
    setupCompleteSub: "Your booking page is ready to receive clients.",
    bookingPageTitle: "Your booking page",
    viewPage: "View page",
    downloadQr: "Download QR code",
    quickAccess: "Quick access",
  },
  verification: {
    title: "Confirm your email",
    bodyPrefix: "We've sent a confirmation link to",
    bodySuffix: "Open it to activate your account and start using Kalendar.",
    confirmedButton: "I've confirmed my email",
    checking: "Checking…",
    resend: "Resend link",
    resendCountdownTemplate: "Resend link ({seconds}s)",
    resending: "Sending…",
    notYet: "We still haven't detected the confirmation. Check your email (and spam folder) and try again.",
    resent: "We've resent the confirmation link.",
    resendError: "Couldn't resend the link. Please try again in a moment.",
    signOut: "Sign out",
  },
  roleUpgrade: {
    title: "One moment",
    body: "This account already exists as a client account. Continuing will add the clinic role to your account. Do you want to continue?",
    yes: "Yes, continue",
    no: "No, go back to my client account",
  },
};

const PANEL_SHELL_DICTIONARIES: Record<Locale, PanelShellDictionary> = { es, en };

export function getPanelShellDictionary(locale: Locale): PanelShellDictionary {
  return PANEL_SHELL_DICTIONARIES[locale];
}
