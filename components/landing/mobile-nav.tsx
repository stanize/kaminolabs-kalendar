"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import type { PublicDictionary } from "@/lib/i18n/dictionaries/public";
import type { Locale } from "@/lib/i18n/config";

interface MobileNavProps {
  navbar: PublicDictionary["navbar"];
  locale: Locale;
}

// Hamburger trigger + dropdown panel, shown only below the md breakpoint.
// Holds the nav links, sign-in link, and language switcher that the desktop
// header shows inline — mobile has no room for them in the header row.
export function MobileNav({ navbar, locale }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center p-1 text-ink-soft transition-colors hover:text-ink"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
      >
        <Icon name={open ? "x" : "menu"} size={24} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-line bg-bg px-5 py-3 shadow-md sm:px-8">
          <nav className="flex flex-col text-[15px] font-medium text-ink-soft">
            <a
              href="#como-funciona"
              onClick={() => setOpen(false)}
              className="border-b border-line/70 py-3 transition-colors hover:text-ink"
            >
              {navbar.howItWorks}
            </a>
            <a
              href="#para-quien"
              onClick={() => setOpen(false)}
              className="border-b border-line/70 py-3 transition-colors hover:text-ink"
            >
              {navbar.whoFor}
            </a>
            <a
              href="#precios"
              onClick={() => setOpen(false)}
              className="border-b border-line/70 py-3 transition-colors hover:text-ink"
            >
              {navbar.pricing}
            </a>
            <div className="flex items-center justify-between py-3">
              <Link href="/panel" onClick={() => setOpen(false)} className="font-semibold text-ink-soft transition-colors hover:text-ink">
                {navbar.signIn}
              </Link>
              <LanguageSwitcher current={locale} revalidate="/" />
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
