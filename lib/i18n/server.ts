import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { getPublicDictionary, type PublicDictionary } from "./dictionaries/public";
import { getPanelShellDictionary, type PanelShellDictionary } from "./dictionaries/panel-shell";

/** Current UI locale from the cookie, defaulting to Spanish. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Locale + the public-surface dictionary (home, onboarding, login, auth). */
export async function getPublicServerDictionary(): Promise<{ locale: Locale; dict: PublicDictionary }> {
  const locale = await getLocale();
  return { locale, dict: getPublicDictionary(locale) };
}

/** Locale + the panel-shell dictionary (sidebar, Inicio, verification gate). */
export async function getPanelShellServerDictionary(): Promise<{ locale: Locale; dict: PanelShellDictionary }> {
  const locale = await getLocale();
  return { locale, dict: getPanelShellDictionary(locale) };
}
