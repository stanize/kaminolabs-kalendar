"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { authClient } from "@/lib/auth-client";

const NAV_ITEMS = [
  { href: "/panel", label: "Inicio", icon: "home", exact: true },
  { href: "/panel/calendario", label: "Calendario", icon: "calendar" },
  { href: "/panel/clientes", label: "Clientes", icon: "users" },
  { href: "/panel/servicios", label: "Servicios", icon: "sparkles" },
  { href: "/panel/disponibilidad", label: "Disponibilidad", icon: "clock" },
  { href: "/panel/equipo", label: "Equipo", icon: "user" },
  { href: "/panel/pagos", label: "Pagos", icon: "creditCard" },
  { href: "/panel/facturas", label: "Facturas", icon: "fileText" },
  { href: "/panel/notificaciones", label: "Emails y avisos", icon: "bell" },
  { href: "/panel/informes", label: "Informes", icon: "barChart" },
  { href: "/panel/integraciones", label: "Integraciones", icon: "grid" },
  { href: "/panel/ajustes", label: "Ajustes", icon: "settings" },
];

const BOTTOM_NAV_ITEMS = [
  { href: "/panel/soporte", label: "Soporte", icon: "lifeBuoy" },
];

export function PanelSidebar({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
  }

  function renderNavItem(item: { href: string; label: string; icon: string; exact?: boolean }) {
    const active = item.exact
      ? pathname === item.href
      : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
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

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-line bg-surface">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <Logo size={18} />
        <Icon name="chevronDown" size={14} className="text-ink-soft" />
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_ITEMS.map((item) => renderNavItem(item))}
      </nav>

      {/* Bottom: Support + User + sign out */}
      <div className="border-t border-line px-3 pt-2 pb-3">
        {/* Support link */}
        <div className="mb-2">
          {BOTTOM_NAV_ITEMS.map((item) => renderNavItem(item))}
        </div>

        <div className="border-t border-line pt-2">
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
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}
