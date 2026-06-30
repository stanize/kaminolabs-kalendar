"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { authClient } from "@/lib/auth-client";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import type { Locale } from "@/lib/i18n/config";
import type { PanelShellDictionary } from "@/lib/i18n/dictionaries/panel-shell";

type SidebarDict = PanelShellDictionary["sidebar"];

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

export function PanelSidebar({
  user,
  dict,
  locale,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  dict: SidebarDict;
  locale: Locale;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Lock background scroll and allow Escape to close while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const NAV_ITEMS: NavItem[] = [
    { href: "/panel", label: dict.home, icon: "home", exact: true },
    { href: "/panel/calendar", label: dict.calendar, icon: "calendar" },
    { href: "/panel/clients", label: dict.clients, icon: "users" },
    { href: "/panel/business", label: dict.business, icon: "building" },
    { href: "/panel/services", label: dict.services, icon: "sparkles" },
    { href: "/panel/team", label: dict.team, icon: "user" },
    { href: "/panel/availability", label: dict.availability, icon: "clock" },
    { href: "/panel/payments", label: dict.payments, icon: "creditCard" },
    { href: "/panel/invoices", label: dict.invoices, icon: "fileText" },
    { href: "/panel/notifications", label: dict.notifications, icon: "bell" },
    { href: "/panel/reports", label: dict.reports, icon: "barChart" },
    { href: "/panel/integrations", label: dict.integrations, icon: "grid" },
    { href: "/panel/settings", label: dict.settings, icon: "settings" },
  ];

  const BOTTOM_NAV_ITEMS: NavItem[] = [
    { href: "/panel/support", label: dict.support, icon: "lifeBuoy" },
  ];

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
  }

  function isActive(item: NavItem): boolean {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  function renderNavItem(item: NavItem, onNavigate?: () => void) {
    const active = isActive(item);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={clsx(
          "flex items-center gap-2.5 rounded-[9px] px-3 py-[8px] text-[13.5px] font-medium transition-colors duration-100",
          active
            ? "bg-brand-weak text-brand-ink font-semibold"
            : "text-ink-soft hover:bg-surface-2 hover:text-ink"
        )}
      >
        <Icon
          name={item.icon}
          size={16}
          strokeWidth={active ? 2.2 : 1.8}
          className={active ? "text-brand" : ""}
        />
        {item.label}
      </Link>
    );
  }

  // Shared content for both the desktop column and the mobile drawer — only
  // the surrounding shell differs, not the nav itself. A plain render function
  // (not a nested component) so it doesn't reset state on every parent render.
  function renderSidebarContent(onNavigate?: () => void) {
    return (
      <>
        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV_ITEMS.map((item) => renderNavItem(item, onNavigate))}
        </nav>

        {/* Bottom: Support + User + sign out */}
        <div className="border-t border-line px-3 pt-2 pb-3">
          <div className="mb-2">
            {BOTTOM_NAV_ITEMS.map((item) => renderNavItem(item, onNavigate))}
          </div>

          <div className="border-t border-line pt-2">
            <div className="mb-2 flex justify-center">
              <LanguageSwitcher current={locale} revalidate="/panel" />
            </div>
            <div className="mb-1 flex items-center gap-2.5 rounded-[9px] px-3 py-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">
                {user.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
                <p className="truncate text-[11.5px] text-ink-soft">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-[8px] text-[13.5px] font-medium text-ink-soft transition-colors duration-100 hover:bg-surface-2 hover:text-ink cursor-pointer"
            >
              <Icon name="logOut" size={16} />
              {dict.signOut}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop: permanent column, hidden below md */}
      <aside className="hidden h-screen w-[240px] shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Logo size={18} />
          <Icon name="chevronDown" size={14} className="text-ink-soft" />
        </div>
        {renderSidebarContent()}
      </aside>

      {/* Mobile: top bar with hamburger, hidden at md and up */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <Logo size={17} />
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="grid h-9 w-9 place-items-center rounded-lg text-ink hover:bg-surface-2"
        >
          <Icon name="menu" size={20} />
        </button>
      </header>

      {/* Mobile: slide-over drawer + backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-[78vw] max-w-[300px] flex-col border-r border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Logo size={18} />
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2 hover:text-ink"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            {renderSidebarContent(() => setOpen(false))}
          </aside>
        </div>
      )}
    </>
  );
}
