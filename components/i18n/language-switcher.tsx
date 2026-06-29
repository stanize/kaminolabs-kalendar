"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/actions/locale";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";

/**
 * Compact language toggle. Sets the locale cookie via a server action, then
 * refreshes so server components re-render in the new language.
 */
export function LanguageSwitcher({
  current,
  revalidate = "/",
}: {
  current: Locale;
  revalidate?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current || pending) return;
    startTransition(async () => {
      await setLocale(locale, revalidate);
      router.refresh();
    });
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => choose(loc)}
          disabled={pending}
          className={`rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${
            loc === current ? "bg-brand text-white" : "text-ink-soft hover:text-ink"
          }`}
          aria-label={LOCALE_LABELS[loc]}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
