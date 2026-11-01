"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { createFestivo, updateFestivo, deleteClosure, type ConflictSummary } from "@/lib/actions/closures";
import { reportClientError } from "@/lib/report-client-error";
import { ClosureConflictDialog } from "@/components/panel/closure-conflict-dialog";
import { AvailabilityHeaderAction } from "@/components/panel/availability-header-action";
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
 *
 * side-panel-pattern: Añadir/Editar both open the same right-docked panel
 * (FestivoPanel below) instead of the old inline expand-in-place forms —
 * same fields, same actions, only the shell changed.
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
  const [panelFestivo, setPanelFestivo] = useState<BusinessClosure | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const visibleFestivos =
    query.trim().length === 0
      ? festivos
      : festivos.filter((f) => {
          const q = query.trim().toLowerCase();
          const dateLabel = formatMonthDay(f.month!, f.day!, intlLocale).toLowerCase();
          return dateLabel.includes(q) || (f.label ?? "").toLowerCase().includes(q);
        });

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
      setFestivos((prev) => prev.filter((f) => f.id !== id));
      setDeletingId(null);
      router.refresh();
    } catch (e) {
      reportClientError("deleteClosure", e);
      setError(dict.errUnexpected);
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-3.5 py-2.5 text-[13px] text-error">
          <Icon name="x" size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <AvailabilityHeaderAction>
        <Btn variant="primary" size="sm" onClick={() => setPanelFestivo("new")}>
          <Icon name="plus" size={15} /> {dict.add}
        </Btn>
      </AvailabilityHeaderAction>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 sm:flex-none sm:w-[280px]">
          <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.searchPlaceholder}
            className="w-full rounded-[10px] border border-line bg-surface py-2 pl-8 pr-3 text-[13px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)] placeholder:text-ink-soft/60"
          />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-4 py-4 sm:px-6">
        {visibleFestivos.length > 0 ? (
          <div className="flex flex-col gap-2">
            {visibleFestivos.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-weak text-brand">
                    <Icon name="calendar" size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-ink">
                      {f.label || formatMonthDay(f.month!, f.day!, intlLocale)}
                    </span>
                    <span className="text-[12.5px] text-ink-soft">
                      {formatMonthDay(f.month!, f.day!, intlLocale)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-weak px-2.5 py-1 text-[11.5px] font-semibold text-brand-ink">
                    <Icon name="check" size={11} /> {dict.statusClosed}
                  </span>
                  <button
                    onClick={() => setPanelFestivo(f)}
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
            ))}
          </div>
        ) : (
          <p className="px-1 py-1 text-[12.5px] text-ink-soft">{query ? dict.noResults : dict.noEntries}</p>
        )}
      </div>

      {panelFestivo && (
        <FestivoPanel
          festivo={panelFestivo === "new" ? null : panelFestivo}
          intlLocale={intlLocale}
          dict={dict}
          conflictDict={conflictDict}
          onClose={() => setPanelFestivo(null)}
          onSaved={(saved) => {
            setPanelFestivo(null);
            setFestivos((prev) => {
              const exists = prev.some((f) => f.id === saved.id);
              const next = exists ? prev.map((f) => (f.id === saved.id ? saved : f)) : [...prev, saved];
              return next.sort((a, b) => (a.month! - b.month!) || (a.day! - b.day!));
            });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function FestivoPanel({
  festivo,
  intlLocale,
  dict,
  conflictDict,
  onClose,
  onSaved,
}: {
  festivo: BusinessClosure | null;
  intlLocale: string;
  dict: FestivosDictionary;
  conflictDict: ClosureConflictDictionary;
  onClose: () => void;
  onSaved: (festivo: BusinessClosure) => void;
}) {
  const [month, setMonth] = useState(festivo?.month ?? 1);
  const [day, setDay] = useState(festivo?.day ?? 1);
  const [label, setLabel] = useState(festivo?.label ?? "");
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
    setSaving(true);
    try {
      const result = festivo
        ? await updateFestivo({ id: festivo.id, month, day, label, confirmed, dict: dict.errors })
        : await createFestivo({ month, day, label, confirmed, dict: dict.errors });
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
      reportClientError(festivo ? "updateFestivo" : "createFestivo", e);
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
          <h2 className="text-[17px] font-bold text-ink">{festivo ? dict.edit : dict.add}</h2>
          <button
            onClick={close}
            aria-label={dict.cancelEdit}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">{error}</div>
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
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${inputBase} w-[160px] capitalize`}>
              {(intlLocale.startsWith("es") ? MONTHS_ES : MONTHS_EN).map((mName, i) => (
                <option key={mName} value={i + 1}>{mName}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[12px] font-semibold text-ink-soft">{dict.nameLabel}</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
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
            {dict.cancelEdit}
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
