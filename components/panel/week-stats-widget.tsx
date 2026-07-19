import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";

/**
 * Esta semana widget: active (pending + confirmed) appointments remaining
 * from right now through the end of the current Madrid-tz week (Mon-Sun) —
 * same "counts down as time passes" behavior as the Hoy widget, just
 * week-scoped. Rolls forward to next week's full count once this week's
 * business hours are entirely done.
 */
export function WeekStatsWidget({
  isThisWeek,
  count,
  dict,
}: {
  isThisWeek: boolean;
  count: number;
  dict: CalendarDictionary["widget"];
}) {
  return (
    <Link
      href="/panel/calendar"
      className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4 transition-colors hover:border-brand-line"
    >
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-weak text-brand">
          <Icon name="calendar" size={17} />
        </div>
        <div className="text-[13px] font-semibold uppercase tracking-[.03em] text-ink-soft">
          {isThisWeek ? dict.weekTitle : dict.nextWeekTitle}
        </div>
      </div>
      <div className="h-8 w-px bg-line" />
      <div className="flex flex-col">
        <span className="text-[20px] font-bold leading-tight text-ink">{count}</span>
        <span className="text-[12px] text-ink-soft">{dict.appointmentsLabel}</span>
      </div>
    </Link>
  );
}
