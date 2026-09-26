"use client";

import { useState } from "react";
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
  const [showAddForm, setShowAddForm] = useState(false);
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

  // Inline edit — reuses the add form's fields, pre-filled, rendered in
  // place of the row being edited. Only one row editable at a time.
  // editX state is separate from the add form's own state above so editing
  // one doesn't disturb whatever's half-typed into the "add" form.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editSingleDay, setEditSingleDay] = useState(false);
  const [editPartialHours, setEditPartialHours] = useState(false);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editLabel, setEditLabel] = useState("");

  // Which save the pending conflict dialog's "Guardar de todas formas"
  // should retry — the add form, or an in-place edit of a specific entry.
  const [pendingConfirm, setPendingConfirm] = useState<{ kind: "add" } | { kind: "edit"; id: string } | null>(null);

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
        setPendingConfirm({ kind: "add" });
        setSaving(false);
        return;
      }
      setConflicts(null);
      setPendingConfirm(null);
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
      setShowAddForm(false);
      setSaving(false);
      router.refresh();
    } catch (e) {
      reportClientError("createTimeOff", e);
      setError(dict.errUnexpected);
      setSaving(false);
    }
  }

  function startEdit(e: BusinessClosure) {
    setError(null);
    setEditingId(e.id);
    setEditStartDate(e.start_date ?? "");
    setEditEndDate(e.end_date ?? "");
    setEditSingleDay(e.start_date === e.end_date);
    setEditPartialHours(!!(e.start_time && e.end_time));
    setEditStartTime(e.start_time?.slice(0, 5) ?? "");
    setEditEndTime(e.end_time?.slice(0, 5) ?? "");
    setEditLabel(e.label ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleEditSave(id: string, confirmed?: boolean) {
    setError(null);
    const effectiveEndDate = editSingleDay ? editStartDate : editEndDate;
    if (!editStartDate || !effectiveEndDate) {
      setError(dict.errors.errInvalidDateRange);
      return;
    }
    setSaving(true);
    try {
      const result = await updateTimeOff({
        id,
        startDate: editStartDate,
        endDate: effectiveEndDate,
        startTime: editPartialHours ? editStartTime : null,
        endTime: editPartialHours ? editEndTime : null,
        label: editLabel,
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
        setPendingConfirm({ kind: "edit", id });
        setSaving(false);
        return;
      }
      setConflicts(null);
      setPendingConfirm(null);
      setEntries((prev) =>
        prev
          .map((e) => (e.id === id ? result.closure : e))
          .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))
      );
      setEditingId(null);
      setSaving(false);
      router.refresh();
    } catch (e) {
      reportClientError("updateTimeOff", e);
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
      if (editingId === id) setEditingId(null);
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
            {entries.map((e) =>
              editingId === e.id ? (
                <div key={e.id} className="flex flex-col gap-2 rounded-lg border border-brand-line bg-brand-weak px-2.5 py-2.5">
                  <label className="flex w-fit cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editSingleDay}
                      onChange={(ev) => {
                        const checked = ev.target.checked;
                        setEditSingleDay(checked);
                        if (checked) setEditEndDate(editStartDate);
                        else setEditPartialHours(false);
                      }}
                      className="h-4 w-4 accent-brand"
                    />
                    <span className="text-[12.5px] text-ink-soft">{dict.singleDay}</span>
                  </label>

                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] font-semibold text-ink-soft">
                        {editSingleDay ? dict.dayLabel : dict.startDate}
                      </label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={(ev) => {
                          setEditStartDate(ev.target.value);
                          if (editSingleDay) setEditEndDate(ev.target.value);
                        }}
                        className={`${inputBase} w-[150px]`}
                      />
                    </div>
                    {!editSingleDay && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[11.5px] font-semibold text-ink-soft">{dict.endDate}</label>
                        <input
                          type="date"
                          value={editEndDate}
                          onChange={(ev) => setEditEndDate(ev.target.value)}
                          className={`${inputBase} w-[150px]`}
                        />
                      </div>
                    )}
                  </div>

                  {editSingleDay && (
                    <label className="flex w-fit cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editPartialHours}
                        onChange={(ev) => setEditPartialHours(ev.target.checked)}
                        disabled={!editStartDate}
                        className="h-4 w-4 accent-brand"
                      />
                      <span className="text-[12.5px] text-ink-soft">{dict.partialHours}</span>
                    </label>
                  )}

                  {editPartialHours && (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11.5px] font-semibold text-ink-soft">{dict.startTime}</label>
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(ev) => setEditStartTime(ev.target.value)}
                          className={`${inputBase} w-[110px]`}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11.5px] font-semibold text-ink-soft">{dict.endTime}</label>
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(ev) => setEditEndTime(ev.target.value)}
                          className={`${inputBase} w-[110px]`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[140px] flex-1">
                      <label className="mb-1 block text-[11.5px] font-semibold text-ink-soft">{dict.nameLabel}</label>
                      <input
                        value={editLabel}
                        onChange={(ev) => setEditLabel(ev.target.value)}
                        placeholder={dict.namePlaceholder}
                        maxLength={80}
                        className={inputBase}
                      />
                    </div>
                    <Btn variant="outline" size="sm" onClick={() => handleEditSave(e.id)} disabled={saving}>
                      {dict.saveEdit}
                    </Btn>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
                      aria-label={dict.cancelEdit}
                    >
                      <Icon name="x" size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-2">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-medium text-ink">{formatRange(e, intlLocale)}</span>
                    {e.label && <span className="text-[12px] text-ink-soft">{e.label}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => startEdit(e)}
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
              )
            )}
          </div>
        ) : (
          <p className="px-1 py-1 text-[12.5px] text-ink-soft">{dict.noEntries}</p>
        )}
      </div>

      <div className="rounded-lg border border-line bg-surface-2/50 p-3">
        {showAddForm ? (
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
                {dict.save}
              </Btn>
              <button
                onClick={() => setShowAddForm(false)}
                disabled={saving}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
                aria-label={dict.cancelAdd}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          </div>
        ) : (
          <Btn variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            <Icon name="plus" size={14} /> {dict.add}
          </Btn>
        )}
      </div>

      {conflicts && pendingConfirm && (
        <ClosureConflictDialog
          conflicts={conflicts}
          intlLocale={intlLocale}
          dict={conflictDict}
          saving={saving}
          onCancel={() => { setConflicts(null); setPendingConfirm(null); }}
          onConfirm={() =>
            pendingConfirm.kind === "add" ? handleAdd(true) : handleEditSave(pendingConfirm.id, true)
          }
        />
      )}
    </div>
  );
}
