"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { SettingsDictionary } from "@/lib/i18n/dictionaries/settings";

const TABS: { href: string; labelKey: keyof SettingsDictionary["tabs"] }[] = [
  { href: "/panel/settings/subscription", labelKey: "subscription" },
  { href: "/panel/settings/notifications", labelKey: "notifications" },
  { href: "/panel/settings/security", labelKey: "security" },
  { href: "/panel/settings/language", labelKey: "language" },
];

export function SettingsTabs({ dict }: { dict: SettingsDictionary }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors duration-100",
              active
                ? "border-brand text-brand-ink font-semibold"
                : "border-transparent text-ink-soft hover:text-ink"
            )}
          >
            {dict.tabs[tab.labelKey]}
          </Link>
        );
      })}
    </div>
  );
}
