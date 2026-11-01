"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { createTimeOff, updateTimeOff, deleteClosure, type ConflictSummary } from "@/lib/actions/closures";
import { reportClientError } from "@/lib/report-client-error";
import { ClosureConflictDialog } from "@/components/panel/closure-conflict-dialog";
import { AvailabilityHeaderAction } from "@/components/panel/availability-header-action";
import type { BusinessClosure } from "@/lib/closures/data";
import type { TimeOffDictionary } from "@/lib/i18n/dictionaries/time-off";
import type { ClosureConflictDictionary } from "@/lib/i18n/dictionaries/closure-conflict";

const inputBase =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)] placeholder:text-ink-soft/60";

interface MemberOption {
  id: string;
  name: string;
}

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
 * Team-wide vacations/time-off list — the "Vacaciones y ausencias" tab on
 * Disponibilidad. Flattened (2026-10-31, per Arun) from a per-provider
 * expand/add-each UI into a single list across every provider, with ONE
 * "+ Añadir" button; the provider is now picked inside the panel itself
 * instead of being implied by which member's section was expanded.
 *
 * side-panel-pattern: Añadir/Editar both open the same right-docked panel
 * (TimeOffPanel below).
 */
export function TimeOffManager({
  members,
  initialEntries,
  intlLocale,
  dict,
  conflictDict,
}: {
  members: MemberOption[];
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Grouped by provider (2026-11-01, per Arun) — every member shown even
  // with zero entries, collapsed by default; the add button/panel stays
  // the single shared one (header-action + provider picker), this only
  // changes how existing entries are displayed.
  const entriesByMember: Record<string, BusinessClosure[]> = {};
  for (const e of entries) {
    if (!e.team_member_id) continue;
    (entriesByMember[e.team_member_id] ??= []).push(e);
  }

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

  if (members.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-3.5 py-2.5 text-[13px] text-error">
          <Icon name="x" size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <AvailabilityHeaderAction>
        <Btn variant="primary" size="sm" onClick={() => setPanelEntry("new")}>
          <Icon name="plus" size={15} /> {dict.add}
        </Btn>
      </AvailabilityHeaderAction>

      <div className="flex flex-col gap-2">
        {members.map((member) => {
          const memberEntries = entriesByMember[member.id] ?? [];
          const isExpanded = expandedId === member.id;
          return (
            <div key={member.id} className="rounded-xl border border-line bg-surface">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : member.id)}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-weak text-brand">
                  <Icon name="user" size={16} />
                </div>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{member.name}</span>
                <span className="shrink-0 text-[12px] font-medium text-ink-soft">
                  {memberEntries.length > 0 ? dict.entriesCountTemplate.replace("{n}", String(memberEntries.length)) : dict.noEntriesShort}
                </span>
                <Icon
                  name="chevronDown"
                  size={16}
                  className={`shrink-0 text-ink-soft transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>
              {isExpanded && memberEntries.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-line px-3.5 py-3">
                  {memberEntries.map((e) => (
                    <div
                      key={e.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2/50 px-3 py-2.5"
                    >
                      <span className="text-[13px] text-ink">
                        {formatRange(e, intlLocale)}
                        {e.label ? ` · ${e.label}` : ""}
                      </span>
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
              )}
            </div>
          );
        })}
      </div>

      {panelEntry && (
        <TimeOffPanel
          entry={panelEntry === "new" ? null : panelEntry}
          members={members}
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
  members,
  intlLocale,
  dict,
  conflictDict,
  onClose,
  onSaved,
}: {
  entry: BusinessClosure | null;
  members: MemberOption[];
  intlLocale: string;
  dict: TimeOffDictionary;
  conflictDict: ClosureConflictDictionary;
  onClose: () => void;
  onSaved: (entry: BusinessClosure) => void;
}) {
  const [teamMemberId, setTeamMemberId] = useState(entry?.team_member_id ?? members[0]?.id ?? "");
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
  const closePanel = () => requestClose(onClose);

  async function handleSave(confirmed?: boolean) {
    setError(null);
    const effectiveEndDate = singleDay ? startDate : endDate;
    if (!startDate || !effectiveEndDate) {
      setError(dict.errors.errInvalidDateRange);
      return;
    }
    if (!entry && !teamMemberId) {
      setError(dict.errors.errNoBusiness);
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
        onClick={closePanel}
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
            onClick={closePanel}
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
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink-soft">{dict.providerLabel}</label>
            {entry ? (
              <p className="text-[14px] font-medium text-ink">{members.find((m) => m.id === entry.team_member_id)?.name ?? "?"}</p>
            ) : (
              <select value={teamMemberId} onChange={(ev) => setTeamMemberId(ev.target.value)} className={inputBase}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
          </div>

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
            onClick={closePanel}
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
