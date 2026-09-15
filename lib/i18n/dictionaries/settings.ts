import type { Locale } from "../config";

export interface SettingsDictionary {
  page: {
    title: string;
    subtitle: string;
  };
  tabs: {
    subscription: string;
    notifications: string;
    bookings: string;
    security: string;
    language: string;
  };
  placeholder: {
    title: string;
    body: string;
  };
  legal: {
    title: string;
    privacy: string;
    terms: string;
  };
}

const es: SettingsDictionary = {
  page: {
    title: "Ajustes",
    subtitle: "Configura tu cuenta y tu negocio en Kalendar.",
  },
  tabs: {
    subscription: "Suscripción",
    notifications: "Notificaciones",
    bookings: "Reservas",
    security: "Seguridad",
    language: "Idioma",
  },
  placeholder: {
    title: "Próximamente",
    body: "Esta sección todavía no está disponible.",
  },
  legal: {
    title: "Legal",
    privacy: "Política de privacidad",
    terms: "Términos de servicio",
  },
};

const en: SettingsDictionary = {
  page: {
    title: "Settings",
    subtitle: "Configure your account and business on Kalendar.",
  },
  tabs: {
    subscription: "Subscription",
    notifications: "Notifications",
    bookings: "Bookings",
    security: "Security",
    language: "Language",
  },
  placeholder: {
    title: "Coming soon",
    body: "This section isn't available yet.",
  },
  legal: {
    title: "Legal",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
  },
};

const SETTINGS_DICTIONARIES: Record<Locale, SettingsDictionary> = { es, en };

export function getSettingsDictionary(locale: Locale): SettingsDictionary {
  return SETTINGS_DICTIONARIES[locale];
}
