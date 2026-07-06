"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/actions/locale";
import { LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * Language dropdown. Shows the current locale (e.g. "ES") with a chevron;
 * clicking reveals the other available locale(s) as a small menu below it.
 * Sets the locale cookie via a server action, then refreshes so server
 * components re-render in the new language.
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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const others = LOCALES.filter((loc) => loc !== current);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function choose(locale: Locale) {
    setOpen(false);
    if (locale === current || pending) return;
    startTransition(async () => {
      await setLocale(locale, revalidate);
      router.refresh();
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="flex items-center gap-1 text-[14.5px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current.toUpperCase()}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+8px)] min-w-[72px] overflow-hidden rounded-lg border border-line bg-surface shadow-md"
        >
          {others.map((loc) => (
            <button
              key={loc}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => choose(loc)}
              className="block w-full px-3 py-2 text-left text-[14px] font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {loc.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
