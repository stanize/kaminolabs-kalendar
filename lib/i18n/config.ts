/**
 * i18n configuration. UI is localizable; the DEFAULT is Spanish. Code stays
 * English everywhere — only these dictionary VALUES are translated. Adding a
 * language later = add its code here + a dictionary object in dictionaries.ts.
 */
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

/** Cookie that stores the user's chosen UI language. */
export const LOCALE_COOKIE = "kalendar_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Human label for each locale (for the switcher). */
export const LOCALE_LABELS: Record<Locale, string> = {
  es: "Español",
  en: "English",
};
