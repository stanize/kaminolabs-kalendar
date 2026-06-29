import type { Locale } from "./config";

/**
 * Translation dictionaries. The shape is defined once (Dictionary) and every
 * locale must satisfy it, so a missing key is a compile error. POC scope:
 * onboarding / sign-up. Sections are namespaced (onboarding, auth) to keep keys
 * organized as this grows to cover the whole app.
 */
export interface Dictionary {
  onboarding: {
    title: string;
    subtitle: string;
  };
  auth: {
    continueGoogle: string;
    connecting: string;
    continueEmail: string;
    termsPrefix: string;
    terms: string;
    termsAnd: string;
    privacy: string;
    termsSuffix: string;
    haveAccount: string;
    signIn: string;
    back: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    createAccount: string;
    creating: string;
    // errors
    errGoogle: string;
    errName: string;
    errEmail: string;
    errPasswordLength: string;
    errPasswordMismatch: string;
    errEmailExists: string;
    errGeneric: string;
    errUnexpected: string;
    errTimeout: (seconds: number) => string;
  };
}

const es: Dictionary = {
  onboarding: {
    title: "Crea tu cuenta",
    subtitle: "Tu página de reservas, lista en 2 minutos.",
  },
  auth: {
    continueGoogle: "Continuar con Google",
    connecting: "Conectando…",
    continueEmail: "Continuar con email",
    termsPrefix: "Al continuar aceptas los",
    terms: "términos",
    termsAnd: "y la",
    privacy: "política de privacidad",
    termsSuffix: "de Kalendar.",
    haveAccount: "¿Ya tienes cuenta?",
    signIn: "Iniciar sesión",
    back: "Volver",
    namePlaceholder: "Tu nombre",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Contraseña (mín. 8 car.)",
    confirmPasswordPlaceholder: "Repite la contraseña",
    createAccount: "Crear cuenta",
    creating: "Un momento…",
    errGoogle: "No se pudo conectar con Google. Inténtalo de nuevo.",
    errName: "Introduce tu nombre.",
    errEmail: "Introduce tu email.",
    errPasswordLength: "La contraseña debe tener al menos 8 caracteres.",
    errPasswordMismatch: "Las contraseñas no coinciden.",
    errEmailExists: "Ya existe una cuenta con ese email.",
    errGeneric: "Error: inténtalo de nuevo.",
    errUnexpected: "Error inesperado.",
    errTimeout: (s) => `Sin respuesta del servidor (${s}s). Inténtalo de nuevo.`,
  },
};

const en: Dictionary = {
  onboarding: {
    title: "Create your account",
    subtitle: "Your booking page, ready in 2 minutes.",
  },
  auth: {
    continueGoogle: "Continue with Google",
    connecting: "Connecting…",
    continueEmail: "Continue with email",
    termsPrefix: "By continuing you accept Kalendar's",
    terms: "terms",
    termsAnd: "and",
    privacy: "privacy policy",
    termsSuffix: ".",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    back: "Back",
    namePlaceholder: "Your name",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password (min. 8 chars)",
    confirmPasswordPlaceholder: "Repeat password",
    createAccount: "Create account",
    creating: "One moment…",
    errGoogle: "Couldn't connect to Google. Please try again.",
    errName: "Enter your name.",
    errEmail: "Enter your email.",
    errPasswordLength: "Password must be at least 8 characters.",
    errPasswordMismatch: "Passwords don't match.",
    errEmailExists: "An account with that email already exists.",
    errGeneric: "Error: please try again.",
    errUnexpected: "Unexpected error.",
    errTimeout: (s) => `No response from the server (${s}s). Please try again.`,
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
