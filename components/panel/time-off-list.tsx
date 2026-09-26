"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { createTimeOff, deleteClosure, type ConflictSummary } from "@/lib/actions/closures";
import { reportClientError } from "@/lib/report-client-error";
import { ClosureConflictDialog } from "@/components/panel/closure-conflict-dialog";
import type { BusinessClosure } from "@/lib/closures/data";
import type { TimeOffDictionary } from "@/lib/i18n/dictionaries/time-off";
import type { ClosureConflictDictionary } from "@/lib/i18n/dictionaries/closure-conflict";

const inputBase =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)] placeholder:text-ink-soft/60";

function formatRange(c: BusinessClosure, intlLocale: string): string {
  const fmt = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", year: "numeric" });
  const start = fmt.format(new Date(`${c.start_date}T00:00:00`));
  const end = fmt.format(new Date(`${c.end_date}T00:00:00`));
  const dateLabel = c.start_date === c.end_date ? start : `${start} – ${end}`;
  if (c.start_time && c.end_time) {
    return `${dateLabel} · ${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}`;
  }
  return dateLabel;
}

/**
 * One provider's time-off list (one-off vacations/absences) — rendered
 * inline under a team-member row on /panel/team. Each add/delete commits
 * immediately, same pattern as FestivosManager. teamMemberId is a saved
 * member's real id (this only renders for saved rows).
 */
export function TimeOffList({
  teamMemberId,
  initialEntries,
  intlLocale,
  dict,
  conflictDict,
}: {
  teamMemberId: string;
  initialEntries: BusinessClosure[];
  intlLocale: string;
  dict: TimeOffDictionary;
  conflictDict: ClosureConflictDictionary;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [singleDay, setSingleDay] = useState(false);
  const [partialHours, setPartialHours] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictSummary | null>(null);

  async function handleAdd(confirmed?: boolean) {
    setError(null);
    // singleDay drives the UI (hides Hasta, relabels Desde as "Día"), but
    // the underlying tracking is unchanged — a single-day entry is just a
    // range whose start and end are the same date.
    const effectiveEndDate = singleDay ? startDate : endDate;
    if (!startDate || !effectiveEndDate) {
      setError(dict.errors.errInvalidDateRange);
      return;
    }
    setSaving(true);
    try {
      const result = await createTimeOff({
        teamMemberId,
        startDate,
        endDate: effectiveEndDate,
        startTime: partialHours ? startTime : null,
        endTime: partialHours ? endTime : null,
        label,
        confirmed,
        dict: dict.errors,
      });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      if ("needsConfirmation" in result) {
        setConflicts(result.conflicts);
        setSaving(false);
        return;
      }
      setConflicts(null);
      setEntries((prev) =>
        [...prev, result.closure].sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))
      );
      setStartDate("");
      setEndDate("");
      setSingleDay(false);
      setPartialHours(false);
      setStartTime("");
      setEndTime("");
      setLabel("");
      setSaving(false);
      router.refresh();
    } catch (e) {
      reportClientError("createTimeOff", e);
      setError(dict.errUnexpected);
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    setDeletingId(id);
    try {
      const result = await deleteClosure({ id, dict: dict.errors });
      if (!result.ok) {
        setError(result.error);
        setDeletingId(null);
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setDeletingId(null);
      router.refresh();
    } catch (e) {
      reportClientError("deleteClosure", e);
      setError(dict.errUnexpected);
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-line bg-surface-2/50 p-3">
      {error && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">
          <Icon name="x" size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {entries.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-2">
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-ink">{formatRange(e, intlLocale)}</span>
                {e.label && <span className="text-[12px] text-ink-soft">{e.label}</span>}
              </div>
              <button
                onClick={() => handleDelete(e.id)}
                disabled={deletingId === e.id}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                aria-label={dict.delete}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex w-fit cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={singleDay}
            onChange={(e) => {
              const checked = e.target.checked;
              setSingleDay(checked);
              if (checked) setEndDate(startDate);
              else setPartialHours(false);
            }}
            className="h-4 w-4 accent-brand"
          />
          <span className="text-[12.5px] text-ink-soft">{dict.singleDay}</span>
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11.5px] font-semibold text-ink-soft">
              {singleDay ? dict.dayLabel : dict.startDate}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (singleDay) setEndDate(e.target.value);
              }}
              className={`${inputBase} w-[150px]`}
            />
          </div>
          {!singleDay && (
            <div className="flex flex-col gap-1">
              <label className="text-[11.5px] font-semibold text-ink-soft">{dict.endDate}</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputBase} w-[150px]`} />
            </div>
          )}
        </div>

        {singleDay && (
          <label className="flex w-fit cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={partialHours}
              onChange={(e) => setPartialHours(e.target.checked)}
              disabled={!startDate}
              className="h-4 w-4 accent-brand"
            />
            <span className="text-[12.5px] text-ink-soft">{dict.partialHours}</span>
          </label>
        )}

        {partialHours && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11.5px] font-semibold text-ink-soft">{dict.startTime}</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputBase} w-[110px]`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11.5px] font-semibold text-ink-soft">{dict.endTime}</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${inputBase} w-[110px]`} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[11.5px] font-semibold text-ink-soft">{dict.nameLabel}</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={dict.namePlaceholder}
              maxLength={80}
              className={inputBase}
            />
          </div>
          <Btn variant="outline" size="sm" onClick={() => handleAdd()} disabled={saving}>
            <Icon name="plus" size={14} /> {dict.add}
          </Btn>
        </div>
      </div>

      {conflicts && (
        <ClosureConflictDialog
          conflicts={conflicts}
          intlLocale={intlLocale}
          dict={conflictDict}
          saving={saving}
          onCancel={() => setConflicts(null)}
          onConfirm={() => handleAdd(true)}
        />
      )}
    </div>
  );
}
