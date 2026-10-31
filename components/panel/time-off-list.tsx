"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { createTimeOff, updateTimeOff, deleteClosure, type ConflictSummary } from "@/lib/actions/closures";
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
 * inline under a team-member row on the Vacaciones tab
 * (/panel/availability/time-off, via ProviderTimeOffManager). Each add/
 * delete commits immediately.
 *
 * side-panel-pattern: Añadir/Editar both open the same right-docked panel
 * (TimeOffPanel below) instead of the old inline expand-in-place forms —
 * same fields, same actions, only the shell changed.
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
  const [panelEntry, setPanelEntry] = useState<BusinessClosure | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm(dict.confirmDelete)) return;
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
    <div className="mt-2 flex flex-col gap-2">
      <div className="rounded-lg border border-line bg-surface-2/50 p-3">
        {error && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">
            <Icon name="x" size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {entries.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-2">
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-ink">{formatRange(e, intlLocale)}</span>
                  {e.label && <span className="text-[12px] text-ink-soft">{e.label}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setPanelEntry(e)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-brand-weak hover:text-brand"
                    aria-label={dict.edit}
                  >
                    <Icon name="pencil" size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    disabled={deletingId === e.id}
                    className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                    aria-label={dict.delete}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-1 py-1 text-[12.5px] text-ink-soft">{dict.noEntries}</p>
        )}
      </div>

      <Btn variant="outline" size="sm" onClick={() => setPanelEntry("new")} className="self-start">
        <Icon name="plus" size={14} /> {dict.add}
      </Btn>

      {panelEntry && (
        <TimeOffPanel
          entry={panelEntry === "new" ? null : panelEntry}
          teamMemberId={teamMemberId}
          intlLocale={intlLocale}
          dict={dict}
          conflictDict={conflictDict}
          onClose={() => setPanelEntry(null)}
          onSaved={(saved) => {
            setPanelEntry(null);
            setEntries((prev) => {
              const exists = prev.some((e) => e.id === saved.id);
              const next = exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved];
              return next.sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
            });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TimeOffPanel({
  entry,
  teamMemberId,
  intlLocale,
  dict,
  conflictDict,
  onClose,
  onSaved,
}: {
  entry: BusinessClosure | null;
  teamMemberId: string;
  intlLocale: string;
  dict: TimeOffDictionary;
  conflictDict: ClosureConflictDictionary;
  onClose: () => void;
  onSaved: (entry: BusinessClosure) => void;
}) {
  const [startDate, setStartDate] = useState(entry?.start_date ?? "");
  const [endDate, setEndDate] = useState(entry?.end_date ?? "");
  const [singleDay, setSingleDay] = useState(entry ? entry.start_date === entry.end_date : false);
  const [partialHours, setPartialHours] = useState(entry ? !!(entry.start_time && entry.end_time) : false);
  const [startTime, setStartTime] = useState(entry?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(entry?.end_time?.slice(0, 5) ?? "");
  const [label, setLabel] = useState(entry?.label ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictSummary | null>(null);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const closingRef = useRef(false);
  function requestClose(after: () => void) {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setTimeout(after, 200);
  }
  const close = () => requestClose(onClose);

  async function handleSave(confirmed?: boolean) {
    setError(null);
    const effectiveEndDate = singleDay ? startDate : endDate;
    if (!startDate || !effectiveEndDate) {
      setError(dict.errors.errInvalidDateRange);
      return;
    }
    setSaving(true);
    try {
      const result = entry
        ? await updateTimeOff({
            id: entry.id,
            startDate,
            endDate: effectiveEndDate,
            startTime: partialHours ? startTime : null,
            endTime: partialHours ? endTime : null,
            label,
            confirmed,
            dict: dict.errors,
          })
        : await createTimeOff({
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
      setSaving(false);
      requestClose(() => onSaved(result.closure));
    } catch (e) {
      reportClientError(entry ? "updateTimeOff" : "createTimeOff", e);
      setError(dict.errUnexpected);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 md:left-[240px]">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={close}
        aria-hidden
      />
      <div
        className={`absolute inset-y-0 right-0 flex h-full w-full flex-col overflow-y-auto bg-surface p-5 shadow-2xl transition-transform duration-200 ease-out sm:w-1/2 sm:min-w-[480px] sm:p-8 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-ink">{entry ? dict.edit : dict.add}</h2>
          <button
            onClick={close}
            aria-label={dict.cancelAdd}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">{error}</div>
        )}

        <div className="flex flex-col gap-3">
          <label className="flex w-fit cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={singleDay}
              onChange={(ev) => {
                const checked = ev.target.checked;
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
              <label className="text-[12px] font-semibold text-ink-soft">{singleDay ? dict.dayLabel : dict.startDate}</label>
              <input
                type="date"
                value={startDate}
                onChange={(ev) => {
                  setStartDate(ev.target.value);
                  if (singleDay) setEndDate(ev.target.value);
                }}
                className={`${inputBase} w-[160px]`}
              />
            </div>
            {!singleDay && (
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold text-ink-soft">{dict.endDate}</label>
                <input type="date" value={endDate} onChange={(ev) => setEndDate(ev.target.value)} className={`${inputBase} w-[160px]`} />
              </div>
            )}
          </div>

          {singleDay && (
            <label className="flex w-fit cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={partialHours}
                onChange={(ev) => setPartialHours(ev.target.checked)}
                disabled={!startDate}
                className="h-4 w-4 accent-brand"
              />
              <span className="text-[12.5px] text-ink-soft">{dict.partialHours}</span>
            </label>
          )}

          {partialHours && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold text-ink-soft">{dict.startTime}</label>
                <input type="time" value={startTime} onChange={(ev) => setStartTime(ev.target.value)} className={`${inputBase} w-[120px]`} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold text-ink-soft">{dict.endTime}</label>
                <input type="time" value={endTime} onChange={(ev) => setEndTime(ev.target.value)} className={`${inputBase} w-[120px]`} />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink-soft">{dict.nameLabel}</label>
            <input
              value={label}
              onChange={(ev) => setLabel(ev.target.value)}
              placeholder={dict.namePlaceholder}
              maxLength={80}
              className={inputBase}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={close}
            disabled={saving}
            className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            {dict.cancelAdd}
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "…" : dict.save}
          </button>
        </div>
      </div>

      {conflicts && (
        <ClosureConflictDialog
          conflicts={conflicts}
          intlLocale={intlLocale}
          dict={conflictDict}
          saving={saving}
          onCancel={() => setConflicts(null)}
          onConfirm={() => handleSave(true)}
        />
      )}
    </div>
  );
}
