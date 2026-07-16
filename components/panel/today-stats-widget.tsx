import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";

export function TodayStatsWidget({
  totalToday,
  dict,
}: {
  totalToday: number;
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
          {dict.title}
        </div>
      </div>
      <div className="h-8 w-px bg-line" />
      <Stat value={totalToday} label={dict.appointmentsLabel} />
    </Link>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[20px] font-bold leading-tight text-ink">{value}</span>
      <span className="text-[12px] text-ink-soft">{label}</span>
    </div>
  );
}
