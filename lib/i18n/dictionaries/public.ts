import type { Locale } from "../config";

/**
 * Dictionary for the entire PUBLIC/AUTH surface: navbar, home (marketing) page,
 * onboarding (sign-up) page + form, login page + form, and (future) password
 * recovery. These pages share a visitor's journey and a lot of vocabulary
 * ("Iniciar sesión", "Crear cuenta", Google/email buttons, etc.), so they live
 * in one dictionary. Panel pages each get their OWN dictionary file instead,
 * since they don't share much language — see lib/i18n/dictionaries/<page>.ts.
 *
 * The language choice is made on the home page (via the navbar switcher) and
 * carries forward automatically through the cookie — onboarding/login do not
 * show a switcher of their own.
 */
export interface PublicDictionary {
  navbar: {
    howItWorks: string;
    whoFor: string;
    pricing: string;
    signIn: string;
    startFree: string;
    language: string;
  };
  home: {
    heroTitle: string;
    heroSubtitle: string;
    startFree: string;
    heroEmailPlaceholder: string;
    noCreditCard: string;
    whoForTitle: string;
    whoForSubtitle: string;
    howTitle: string;
    step1Title: string;
    step1Text: string;
    step2Title: string;
    step2Text: string;
    step3Title: string;
    step3Text: string;
    ctaTitle: string;
    ctaSubtitle: string;
    ctaButton: string;
    footerTagline: string;
    footerRights: string;
    // Decorative booking-page preview cards on the home page.
    previewYourBusiness: string;
    previewDefaultTagline: string;
    previewChooseService: string;
    previewFirstService: string;
    previewService: string;
    previewChooseDay: string;
  };
  signup: {
    // Left dark panel (split-screen layout).
    title: string;
    subtitle: string;
  };
  signin: {
    title: string;
    subtitle: string;
    noAccount: string;
    createFree: string;
  };
  forgotPassword: {
    title: string;
    subtitle: string;
    sendLink: string;
    sending: string;
    checkEmailTitle: string;
    checkEmailBody: string;
    backToSignin: string;
  };
  resetPassword: {
    title: string;
    subtitle: string;
    newPasswordPlaceholder: string;
    resetButton: string;
    resetting: string;
    successTitle: string;
    successBody: string;
    goToSignin: string;
    invalidTokenTitle: string;
    invalidTokenBody: string;
    requestNewLink: string;
  };
  auth: {
    // Shared by the sign-up and login forms.
    continueGoogle: string;
    connecting: string;
    continueEmail: string;
    orDivider: string;
    termsPrefix: string;
    terms: string;
    termsAnd: string;
    privacy: string;
    termsSuffix: string;
    haveAccount: string;
    signIn: string;
    back: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    createAccount: string;
    creating: string;
    loggingIn: string;
    forgotPasswordLink: string;
    // errors
    errGoogle: string;
    errEmail: string;
    errPasswordLength: string;
    errPasswordMismatch: string;
    errEmailExists: string;
    errEmptyFields: string;
    errBadCredentials: string;
    errGeneric: string;
    errUnexpected: string;
    errTimeout: string;
  };
}

const es: PublicDictionary = {
  navbar: {
    howItWorks: "Cómo funciona",
    whoFor: "Para quién es",
    pricing: "Precios",
    signIn: "Iniciar sesión",
    startFree: "Empezar gratis",
    language: "Idioma",
  },
  home: {
    heroTitle: "Reservas para tu clínica, sin llamadas",
    heroSubtitle: "Tu página de reservas, lista en 2 minutos.",
    startFree: "Crear cuenta gratis",
    heroEmailPlaceholder: "Introduce tu email",
    noCreditCard: "Sin tarjeta de crédito",
    whoForTitle: "Pensado para quien atiende citas, no agendas",
    whoForSubtitle:
      "Kalendar se adapta a tu profesión desde el primer minuto, con plantillas de servicios pensadas para cada sector.",
    howTitle: "Listo para recibir reservas en 3 pasos",
    step1Title: "Crea tu cuenta",
    step1Text: "Con tu correo o con Google. Sin tarjeta, sin compromiso.",
    step2Title: "Configura tu negocio",
    step2Text: "Añade tus servicios, tu horario y tu equipo en un par de minutos.",
    step3Title: "Comparte tu enlace",
    step3Text: "Tu página kalendar.kaminolabs.dev/bookings/tu-negocio ya está lista para recibir reservas.",
    ctaTitle: "Tu página de reservas, lista hoy mismo",
    ctaSubtitle: "Únete a Kalendar y deja que tus clientes reserven solos, a cualquier hora.",
    ctaButton: "Empezar gratis",
    footerTagline: "Kalendar — de KaminoLabs",
    footerRights: "Todos los derechos reservados.",
    previewYourBusiness: "Tu negocio",
    previewDefaultTagline: "Reserva tu cita online",
    previewChooseService: "Elige un servicio",
    previewFirstService: "Tu primer servicio",
    previewService: "Servicio",
    previewChooseDay: "Elige día",
  },
  signup: {
    title: "Crea tu cuenta gratis",
    subtitle: "Automatiza las tareas administrativas de tu clínica y dedica tu tiempo a tus clientes.",
  },
  signin: {
    title: "Bienvenido de nuevo",
    subtitle: "Inicia sesión en tu cuenta de Kalendar.",
    noAccount: "¿No tienes cuenta?",
    createFree: "Crear una gratis",
  },
  forgotPassword: {
    title: "Recupera tu contraseña",
    subtitle: "Te enviaremos un enlace para restablecerla.",
    sendLink: "Enviar enlace",
    sending: "Enviando…",
    checkEmailTitle: "Revisa tu email",
    checkEmailBody:
      "Si existe una cuenta con ese email, te hemos enviado un enlace para restablecer tu contraseña.",
    backToSignin: "Volver a iniciar sesión",
  },
  resetPassword: {
    title: "Crea una nueva contraseña",
    subtitle: "Elige una contraseña nueva para tu cuenta.",
    newPasswordPlaceholder: "Nueva contraseña (mín. 8 car.)",
    resetButton: "Restablecer contraseña",
    resetting: "Restableciendo…",
    successTitle: "Contraseña actualizada",
    successBody: "Ya puedes iniciar sesión con tu nueva contraseña.",
    goToSignin: "Ir a iniciar sesión",
    invalidTokenTitle: "Enlace no válido o caducado",
    invalidTokenBody: "Solicita un nuevo enlace para restablecer tu contraseña.",
    requestNewLink: "Solicitar nuevo enlace",
  },
  auth: {
    continueGoogle: "Continuar con Google",
    connecting: "Conectando…",
    continueEmail: "Continuar con email",
    orDivider: "o",
    termsPrefix: "Al continuar aceptas los",
    terms: "términos",
    termsAnd: "y la",
    privacy: "política de privacidad",
    termsSuffix: "de Kalendar.",
    haveAccount: "¿Ya tienes cuenta?",
    signIn: "Iniciar sesión",
    back: "Volver",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Contraseña (mín. 8 car.)",
    confirmPasswordPlaceholder: "Repite la contraseña",
    createAccount: "Crear cuenta",
    creating: "Un momento…",
    loggingIn: "Un momento…",
    forgotPasswordLink: "¿Olvidaste tu contraseña?",
    errGoogle: "No se pudo conectar con Google. Inténtalo de nuevo.",
    errEmail: "Introduce tu email.",
    errPasswordLength: "La contraseña debe tener al menos 8 caracteres.",
    errPasswordMismatch: "Las contraseñas no coinciden.",
    errEmailExists: "Ya existe una cuenta con ese email.",
    errEmptyFields: "Por favor rellena todos los campos.",
    errBadCredentials: "Email o contraseña incorrectos.",
    errGeneric: "Error: inténtalo de nuevo.",
    errUnexpected: "Error inesperado.",
    errTimeout: "Sin respuesta del servidor. Inténtalo de nuevo.",
  },
};

const en: PublicDictionary = {
  navbar: {
    howItWorks: "How it works",
    whoFor: "Who it's for",
    pricing: "Pricing",
    signIn: "Sign in",
    startFree: "Start for free",
    language: "Language",
  },
  home: {
    heroTitle: "Bookings for your clinic, no phone calls",
    heroSubtitle: "Your booking page, ready in 2 minutes.",
    startFree: "Create free account",
    heroEmailPlaceholder: "Enter your email",
    noCreditCard: "No credit card required",
    whoForTitle: "Built for people who handle appointments, not spreadsheets",
    whoForSubtitle: "Kalendar adapts to your profession from minute one, with service templates for every sector.",
    howTitle: "Ready to take bookings in 3 steps",
    step1Title: "Create your account",
    step1Text: "With your email or Google. No card, no commitment.",
    step2Title: "Set up your business",
    step2Text: "Add your services, hours, and team in a couple of minutes.",
    step3Title: "Share your link",
    step3Text: "Your page at kalendar.kaminolabs.dev/bookings/your-business is ready to take bookings.",
    ctaTitle: "Your booking page, ready today",
    ctaSubtitle: "Join Kalendar and let your clients book themselves, any time of day.",
    ctaButton: "Start for free",
    footerTagline: "Kalendar — by KaminoLabs",
    footerRights: "All rights reserved.",
    previewYourBusiness: "Your business",
    previewDefaultTagline: "Book your appointment online",
    previewChooseService: "Choose a service",
    previewFirstService: "Your first service",
    previewService: "Service",
    previewChooseDay: "Choose a day",
  },
  signup: {
    title: "Create your free account",
    subtitle: "Automate your clinic's admin work and spend your time on your clients.",
  },
  signin: {
    title: "Welcome back",
    subtitle: "Sign in to your Kalendar account.",
    noAccount: "Don't have an account?",
    createFree: "Create one for free",
  },
  forgotPassword: {
    title: "Reset your password",
    subtitle: "We'll send you a link to reset it.",
    sendLink: "Send reset link",
    sending: "Sending…",
    checkEmailTitle: "Check your email",
    checkEmailBody:
      "If an account exists with that email, we've sent a link to reset your password.",
    backToSignin: "Back to sign in",
  },
  resetPassword: {
    title: "Create a new password",
    subtitle: "Choose a new password for your account.",
    newPasswordPlaceholder: "New password (min. 8 chars)",
    resetButton: "Reset password",
    resetting: "Resetting…",
    successTitle: "Password updated",
    successBody: "You can now sign in with your new password.",
    goToSignin: "Go to sign in",
    invalidTokenTitle: "Invalid or expired link",
    invalidTokenBody: "Request a new link to reset your password.",
    requestNewLink: "Request new link",
  },
  auth: {
    continueGoogle: "Continue with Google",
    connecting: "Connecting…",
    continueEmail: "Continue with email",
    orDivider: "or",
    termsPrefix: "By continuing you accept Kalendar's",
    terms: "terms",
    termsAnd: "and",
    privacy: "privacy policy",
    termsSuffix: ".",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    back: "Back",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password (min. 8 chars)",
    confirmPasswordPlaceholder: "Repeat password",
    createAccount: "Create account",
    creating: "One moment…",
    loggingIn: "One moment…",
    forgotPasswordLink: "Forgot your password?",
    errGoogle: "Couldn't connect to Google. Please try again.",
    errEmail: "Enter your email.",
    errPasswordLength: "Password must be at least 8 characters.",
    errPasswordMismatch: "Passwords don't match.",
    errEmailExists: "An account with that email already exists.",
    errEmptyFields: "Please fill in all fields.",
    errBadCredentials: "Incorrect email or password.",
    errGeneric: "Error: please try again.",
    errUnexpected: "Unexpected error.",
    errTimeout: "No response from the server. Please try again.",
  },
};

const PUBLIC_DICTIONARIES: Record<Locale, PublicDictionary> = { es, en };

export function getPublicDictionary(locale: Locale): PublicDictionary {
  return PUBLIC_DICTIONARIES[locale];
}
