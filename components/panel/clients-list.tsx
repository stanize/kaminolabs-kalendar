"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { ClientListItem } from "@/lib/clients/data";
import type { ClientsDictionary } from "@/lib/i18n/dictionaries/clients";
import type { Locale } from "@/lib/i18n/config";

export function ClientsList({
  clients, dict, locale,
}: {
  clients: ClientListItem[];
  dict: ClientsDictionary;
  locale: Locale;
}) {
  const [query, setQuery] = useState("");
  const l = dict.list;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q)
    );
  }, [clients, query]);

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft">
          <Icon name="users" size={22} />
        </div>
        <p className="text-[14.5px] font-semibold text-ink">{l.emptyTitle}</p>
        <p className="mt-1 text-[13px] text-ink-soft">{l.emptySubtitle}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Icon name="users" size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={l.searchPlaceholder}
          className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] text-ink outline-none focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-1 text-[13.5px] text-ink-soft">{l.noResults}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {filtered.map((c, i) => (
            <Link
              key={c.id}
              href={`/panel/clients/${c.id}`}
              className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-weak text-[13px] font-bold text-brand-ink">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{c.name}</p>
                <p className="truncate text-[12.5px] text-ink-soft">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-semibold text-ink">
                  {c.totalSessions} {l.sessionsUnit}
                </p>
                <p className="text-[11.5px] text-ink-soft">
                  {c.lastVisitAt
                    ? l.lastVisit.replace("{date}", formatDate(c.lastVisitAt, locale))
                    : l.noVisitYet}
                </p>
              </div>
              <Icon name="chevronRight" size={15} className="shrink-0 text-ink-soft" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}
