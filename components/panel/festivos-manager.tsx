"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { createFestivo, updateFestivo, deleteClosure, type ConflictSummary } from "@/lib/actions/closures";
import { reportClientError } from "@/lib/report-client-error";
import { ClosureConflictDialog } from "@/components/panel/closure-conflict-dialog";
import type { BusinessClosure } from "@/lib/closures/data";
import type { FestivosDictionary } from "@/lib/i18n/dictionaries/festivos";
import type { ClosureConflictDictionary } from "@/lib/i18n/dictionaries/closure-conflict";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthDay(month: number, day: number, intlLocale: string): string {
  const months = intlLocale.startsWith("es") ? MONTHS_ES : MONTHS_EN;
  const monthName = months[month - 1];
  return `${day} ${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}`;
}

const inputBase =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)] placeholder:text-ink-soft/60";

/**
 * Festivos (recurring annual public holidays) — clinic-wide, month+day only.
 * Lives on /panel/availability alongside the weekly-hours editor. Each add/
 * delete commits immediately (no batch save, unlike the weekly-hours grid —
 * a festivo list has no cross-row validation that needs a single atomic
 * commit).
 */
export function FestivosManager({
  initialFestivos,
  intlLocale,
  dict,
  conflictDict,
}: {
  initialFestivos: BusinessClosure[];
  intlLocale: string;
  dict: FestivosDictionary;
  conflictDict: ClosureConflictDictionary;
}) {
  const router = useRouter();
  const [festivos, setFestivos] = useState(initialFestivos);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictSummary | null>(null);

  // Inline edit — reuses the add form's day/month/label inputs, pre-filled,
  // rendered in place of the row being edited. Only one row editable at a
  // time. editMonth/editDay/editLabel are separate from the add form's own
  // month/day/label state above so editing one doesn't disturb whatever the
  // clinic has half-typed into the "add" row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMonth, setEditMonth] = useState(1);
  const [editDay, setEditDay] = useState(1);
  const [editLabel, setEditLabel] = useState("");

  // Which save the pending conflict dialog's "Guardar de todas formas"
  // should retry — the add form, or an in-place edit of a specific festivo.
  const [pendingConfirm, setPendingConfirm] = useState<{ kind: "add" } | { kind: "edit"; id: string } | null>(null);

  async function handleAdd(confirmed?: boolean) {
    setError(null);
    setSaving(true);
    try {
      const result = await createFestivo({ month, day, label, confirmed, dict: dict.errors });
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
      setFestivos((prev) => [...prev, result.closure].sort((a, b) => (a.month! - b.month!) || (a.day! - b.day!)));
      setLabel("");
      setSaving(false);
      router.refresh();
    } catch (e) {
      reportClientError("createFestivo", e);
      setError(dict.errUnexpected);
      setSaving(false);
    }
  }

  function startEdit(f: BusinessClosure) {
    setError(null);
    setEditingId(f.id);
    setEditMonth(f.month!);
    setEditDay(f.day!);
    setEditLabel(f.label ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleEditSave(id: string, confirmed?: boolean) {
    setError(null);
    setSaving(true);
    try {
      const result = await updateFestivo({ id, month: editMonth, day: editDay, label: editLabel, confirmed, dict: dict.errors });
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
      setFestivos((prev) =>
        prev
          .map((f) => (f.id === id ? result.closure : f))
          .sort((a, b) => (a.month! - b.month!) || (a.day! - b.day!))
      );
      setEditingId(null);
      setSaving(false);
      router.refresh();
    } catch (e) {
      reportClientError("updateFestivo", e);
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
      setFestivos((prev) => prev.filter((f) => f.id !== id));
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
    <div className="rounded-xl border border-line bg-surface px-4 py-4 sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon name="calendar" size={17} className="text-brand" />
        <h2 className="text-[16px] font-semibold text-ink">{dict.title}</h2>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-error bg-error-weak px-3.5 py-2.5 text-[13px] text-error">
          <Icon name="x" size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {festivos.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 border-b border-line pb-4">
          {festivos.map((f) =>
            editingId === f.id ? (
              <div key={f.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-brand-line bg-brand-weak px-3 py-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-ink-soft">{dict.dayLabel}</label>
                  <select value={editDay} onChange={(e) => setEditDay(Number(e.target.value))} className={`${inputBase} w-[70px]`}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-ink-soft">{dict.monthLabel}</label>
                  <select value={editMonth} onChange={(e) => setEditMonth(Number(e.target.value))} className={`${inputBase} w-[140px] capitalize`}>
                    {(intlLocale.startsWith("es") ? MONTHS_ES : MONTHS_EN).map((mName, i) => (
                      <option key={mName} value={i + 1}>{mName}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="mb-1 block text-[11px] font-semibold text-ink-soft">{dict.nameLabel}</label>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder={dict.namePlaceholder}
                    maxLength={80}
                    className={inputBase}
                  />
                </div>
                <Btn variant="outline" onClick={() => handleEditSave(f.id)} disabled={saving}>
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
            ) : (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5"
              >
                <div className="flex flex-col">
                  <span className="text-[14px] font-medium text-ink">
                    {formatMonthDay(f.month!, f.day!, intlLocale)}
                  </span>
                  {f.label && <span className="text-[12.5px] text-ink-soft">{f.label}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => startEdit(f)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-brand-weak hover:text-brand"
                    aria-label={dict.edit}
                  >
                    <Icon name="pencil" size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(f.id)}
                    disabled={deletingId === f.id}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                    aria-label={dict.delete}
                  >
                    <Icon name="x" size={15} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-semibold text-ink-soft">{dict.dayLabel}</label>
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={`${inputBase} w-[70px]`}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-semibold text-ink-soft">{dict.monthLabel}</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${inputBase} w-[140px] capitalize`}>
            {(intlLocale.startsWith("es") ? MONTHS_ES : MONTHS_EN).map((mName, i) => (
              <option key={mName} value={i + 1}>{mName}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-[12px] font-semibold text-ink-soft">{dict.nameLabel}</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={dict.namePlaceholder}
            maxLength={80}
            className={inputBase}
          />
        </div>
        <Btn variant="outline" onClick={() => handleAdd()} disabled={saving}>
          <Icon name="plus" size={15} /> {dict.add}
        </Btn>
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
