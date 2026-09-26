"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { AvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";

const TABS: { href: string; labelKey: keyof AvailabilityDictionary["tabs"] }[] = [
  { href: "/panel/availability", labelKey: "hours" },
  { href: "/panel/availability/holidays", labelKey: "holidays" },
  { href: "/panel/availability/time-off", labelKey: "timeOff" },
];

export function AvailabilityTabs({ dict }: { dict: AvailabilityDictionary }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((tab) => {
        // Exact match for the hours tab (its href is a prefix of every
        // other tab's href too), startsWith for the rest.
        const active = tab.href === "/panel/availability" ? pathname === tab.href : pathname.startsWith(tab.href);
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
