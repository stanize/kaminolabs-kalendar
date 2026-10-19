"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { WeekMemberVM } from "@/components/panel/calendar-grid-view";

/**
 * multi-provider-calendar-display (workflows/calendar-management-upcoming.md):
 * the persistent, multi-select provider filter shared by Day/Week view.
 * Nothing checked = "all providers" (the default) — the selection state
 * alone covers all/one/a-few, no separate mode toggle needed.
 */
export function CalendarProviderFilter({
  members,
  selectedIds,
  onChange,
  allLabel,
  triggerLabel,
}: {
  members: WeekMemberVM[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  allLabel: string;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const allSelected = selectedIds.length === 0;
  const summary = allSelected
    ? allLabel
    : selectedIds.length === 1
      ? members.find((m) => m.id === selectedIds[0])?.name ?? allLabel
      : `${selectedIds.length}`;

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-2"
      >
        <Icon name="users" size={14} className="text-ink-soft" />
        {triggerLabel}
        {!allSelected && (
          <span className="rounded-full bg-brand-weak px-1.5 py-0.5 text-[11px] font-semibold text-brand-ink">
            {summary}
          </span>
        )}
        <Icon name="chevronDown" size={14} className="text-ink-soft" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 min-w-[200px] rounded-xl border border-line bg-surface p-2 shadow-lg">
          <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13.5px] text-ink hover:bg-surface-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChange([])}
              className="h-4 w-4 rounded border-line"
            />
            {allLabel}
          </label>
          <div className="my-1 border-t border-line" />
          {members.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13.5px] text-ink hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(member.id)}
                onChange={() => toggle(member.id)}
                className="h-4 w-4 rounded border-line"
              />
              {member.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
