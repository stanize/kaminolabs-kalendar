import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Btn } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { MobileNav } from "@/components/landing/mobile-nav";
import { getPublicServerDictionary } from "@/lib/i18n/server";

export async function Navbar() {
  const { locale, dict } = await getPublicServerDictionary();

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/85 backdrop-blur">
      <div className="relative mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <MobileNav navbar={dict.navbar} locale={locale} />
          <Logo size={20} tagline compactOnMobile />
        </div>

        <nav className="hidden items-center gap-8 text-[14.5px] font-medium text-ink-soft md:flex">
          <a href="#como-funciona" className="transition-colors hover:text-ink">
            {dict.navbar.howItWorks}
          </a>
          <a href="#para-quien" className="transition-colors hover:text-ink">
            {dict.navbar.whoFor}
          </a>
          <a href="#precios" className="transition-colors hover:text-ink">
            {dict.navbar.pricing}
          </a>
          {/* The language choice is made here, on the home page. It carries
              forward via cookie into onboarding/login — they show no switcher. */}
          <LanguageSwitcher current={locale} revalidate="/" />
        </nav>

        <div className="flex items-center gap-4">
          {/* /panel redirects to /onboarding if no session, or shows the panel if logged in */}
          <Link
            href="/panel"
            className="rounded-full border border-line px-4 py-1.5 text-[14.5px] font-semibold text-ink-soft transition-colors hover:border-brand-line hover:text-ink"
          >
            {dict.navbar.signIn}
          </Link>
          <Link href="/onboarding" className="hidden md:inline">
            <Btn size="sm" className="rounded-full">{dict.navbar.startFree}</Btn>
          </Link>
        </div>
      </div>
    </header>
  );
}
