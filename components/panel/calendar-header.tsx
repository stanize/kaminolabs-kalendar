"use client";

import { Icon } from "@/components/ui/icon";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";

export type CalendarViewMode = "day" | "week" | "month";

export function CalendarHeader({
  view,
  onViewChange,
  rangeLabel,
  onPrev,
  onNext,
  onToday,
  loading,
  dict,
}: {
  view: CalendarViewMode;
  onViewChange: (view: CalendarViewMode) => void;
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  loading?: boolean;
  dict: CalendarDictionary["week"];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onToday}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft hover:bg-surface-2 hover:text-ink"
        >
          {dict.today}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            aria-label={dict.prevLabel}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-ink-soft hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <button
            onClick={onNext}
            aria-label={dict.nextLabel}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-ink-soft hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <span className="ml-1 text-[14.5px] font-semibold capitalize text-ink">{rangeLabel}</span>
        {loading && <span className="text-[12px] text-ink-soft">…</span>}
      </div>

      <select
        value={view}
        onChange={(e) => onViewChange(e.target.value as CalendarViewMode)}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink"
      >
        <option value="day">{dict.viewDay}</option>
        <option value="week">{dict.viewWeek}</option>
        <option value="month">{dict.viewMonth}</option>
      </select>
    </div>
  );
}
