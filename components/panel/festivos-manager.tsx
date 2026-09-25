"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { createFestivo, deleteClosure } from "@/lib/actions/closures";
import { reportClientError } from "@/lib/report-client-error";
import type { BusinessClosure } from "@/lib/closures/data";
import type { FestivosDictionary } from "@/lib/i18n/dictionaries/festivos";

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
  return `${day} ${months[month - 1]}`;
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
}: {
  initialFestivos: BusinessClosure[];
  intlLocale: string;
  dict: FestivosDictionary;
}) {
  const router = useRouter();
  const [festivos, setFestivos] = useState(initialFestivos);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    setSaving(true);
    try {
      const result = await createFestivo({ month, day, label, dict: dict.errors });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
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
      <div className="mb-1 flex items-center gap-2">
        <Icon name="calendar" size={17} className="text-brand" />
        <h2 className="text-[16px] font-semibold text-ink">{dict.title}</h2>
      </div>
      <p className="mb-4 text-[13px] text-ink-soft">{dict.subtitle}</p>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-error bg-error-weak px-3.5 py-2.5 text-[13px] text-error">
          <Icon name="x" size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {festivos.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {festivos.map((f) => (
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
              <button
                onClick={() => handleDelete(f.id)}
                disabled={deletingId === f.id}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                aria-label={dict.delete}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
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
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${inputBase} w-[140px]`}>
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
        <Btn variant="outline" onClick={handleAdd} disabled={saving}>
          <Icon name="plus" size={15} /> {dict.add}
        </Btn>
      </div>
    </div>
  );
}
