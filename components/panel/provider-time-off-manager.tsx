"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { TimeOffList } from "@/components/panel/time-off-list";
import type { TimeOffDictionary } from "@/lib/i18n/dictionaries/time-off";
import type { ClosureConflictDictionary } from "@/lib/i18n/dictionaries/closure-conflict";
import type { BusinessClosure } from "@/lib/closures/data";

interface MemberVM {
  id: string;
  name: string;
  isOwner: boolean;
}

/**
 * Per-provider time off — lives on Disponibilidad alongside Festivos, so
 * everything schedule-related (weekly hours, festivos, personal time off)
 * is managed in one place (moved here from Equipo, 2026-09-26, Arun's
 * request). Purely a list/expand view — the roster itself (add/rename/
 * remove members) still lives on Equipo; this only reads member id/name.
 */
export function ProviderTimeOffManager({
  members,
  timeOffByMember,
  dict,
  conflictDict,
  intlLocale,
}: {
  members: MemberVM[];
  timeOffByMember: Record<string, BusinessClosure[]>;
  dict: TimeOffDictionary;
  conflictDict: ClosureConflictDictionary;
  intlLocale: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (members.length === 0) return null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-1 text-[15px] font-bold text-ink">{dict.title}</h2>
      <p className="mb-3 text-[13px] text-ink-soft">{dict.subtitle}</p>
      <div className="flex flex-col gap-1">
        {members.map((member) => {
          const isExpanded = expandedId === member.id;
          const entries = timeOffByMember[member.id] ?? [];
          return (
            <div key={member.id} className="border-t border-line/60 pt-2 first:border-t-0 first:pt-0">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : member.id)}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] font-semibold text-ink hover:bg-surface-2"
              >
                <Icon name="calendar" size={14} className="shrink-0 text-brand" />
                {member.name}
                <span className="ml-auto text-[12px] font-medium text-brand">
                  {isExpanded ? dict.toggleHide : dict.toggleShow}
                  {entries.length > 0 && !isExpanded ? ` (${entries.length})` : ""}
                </span>
              </button>
              {isExpanded && (
                <div className="pl-1">
                  <TimeOffList
                    teamMemberId={member.id}
                    initialEntries={entries}
                    intlLocale={intlLocale}
                    dict={dict}
                    conflictDict={conflictDict}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
