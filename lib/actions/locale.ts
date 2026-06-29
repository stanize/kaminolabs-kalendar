"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

/**
 * Sets the UI language cookie. Public (no auth needed — language is a UI
 * preference, relevant before sign-in too). One year, lax, site-wide.
 */
export async function setLocale(locale: string, revalidate: string = "/"): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath(revalidate);
}
