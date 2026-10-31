"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import {
  createCustomTimeSlotRule,
  updateCustomTimeSlotRule,
  deleteCustomTimeSlotRule,
} from "@/lib/actions/custom-slots";
import { isOutsideBusinessHours, type TimeRangeVM } from "@/lib/booking/appointment-fields";
import { reportClientError } from "@/lib/report-client-error";
import type { CustomTimeSlotRule } from "@/lib/custom-slots/data";
import type { CustomSlotsDictionary } from "@/lib/i18n/dictionaries/custom-slots";
import type { AvailabilityDictionary } from "@/lib/i18n/dictionaries/availability";
import type { DayId } from "@/lib/onboarding/types";

const DAY_ORDER: DayId[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface MemberOption {
  id: string;
  name: string;
}

export function CustomTimeSlotsManager({
  initialRules,
  members,
  hoursByDay,
  dict,
  availabilityDict,
}: {
  initialRules: CustomTimeSlotRule[];
  members: MemberOption[];
  hoursByDay: Partial<Record<DayId, TimeRangeVM[]>>;
  dict: CustomSlotsDictionary;
  availabilityDict: AvailabilityDictionary;
}) {
  const [rules, setRules] = useState(initialRules);
  const [panelRule, setPanelRule] = useState<CustomTimeSlotRule | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm(dict.confirmDelete)) return;
    setError(null);
    setDeletingId(id);
    try {
      const res = await deleteCustomTimeSlotRule(id, dict.errors);
      setDeletingId(null);
      if (!res.ok) { setError(res.error); return; }
      setRules((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setDeletingId(null);
      reportClientError("deleteCustomTimeSlotRule", e);
      setError(dict.errUnexpected);
    }
  }

  function memberName(id: string): string {
    return members.find((m) => m.id === id)?.name ?? "?";
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-soft">{dict.subtitle}</p>

      {error && (
        <div className="rounded-lg border border-error bg-error-weak px-3 py-2 text-[13px] text-error">{error}</div>
      )}

      <Btn variant="outline" size="sm" onClick={() => setPanelRule("new")} className="self-start">
        {dict.addButton}
      </Btn>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-5 text-center">
          <p className="text-[14px] font-semibold text-ink">{dict.emptyTitle}</p>
          <p className="mt-1 text-[12.5px] text-ink-soft">{dict.emptySubtitle}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">
                  {r.label || dict.panelTitleNew}
                </p>
                <p className="truncate text-[12.5px] text-ink-soft">
                  {r.days.length === 0 ? dict.allDaysSummary : r.days.map((d) => availabilityDict.weekdaysShort[d]).join(", ")}
                  {" · "}
                  {r.teamMemberIds.length === 0 ? dict.allProvidersSummary : r.teamMemberIds.map(memberName).join(", ")}
                  {" · "}
                  {dict.timesCountTemplate.replace("{n}", String(r.times.length))}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPanelRule(r)}
                  aria-label={dict.editAria}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
                >
                  <Icon name="pencil" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  disabled={deletingId === r.id}
                  aria-label={dict.deleteAria}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error disabled:opacity-50"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {panelRule && (
        <RulePanel
          rule={panelRule === "new" ? null : panelRule}
          members={members}
          hoursByDay={hoursByDay}
          dict={dict}
          availabilityDict={availabilityDict}
          onClose={() => setPanelRule(null)}
          onSaved={(saved) => {
            setPanelRule(null);
            setRules((rs) => {
              const exists = rs.some((r) => r.id === saved.id);
              return exists ? rs.map((r) => (r.id === saved.id ? saved : r)) : [...rs, saved];
            });
          }}
        />
      )}
    </div>
  );
}

function RulePanel({
  rule,
  members,
  hoursByDay,
  dict,
  availabilityDict,
  onClose,
  onSaved,
}: {
  rule: CustomTimeSlotRule | null;
  members: MemberOption[];
  hoursByDay: Partial<Record<DayId, TimeRangeVM[]>>;
  dict: CustomSlotsDictionary;
  availabilityDict: AvailabilityDictionary;
  onClose: () => void;
  onSaved: (rule: CustomTimeSlotRule) => void;
}) {
  const [label, setLabel] = useState(rule?.label ?? "");
  const [allDays, setAllDays] = useState((rule?.days.length ?? 0) === 0);
  const [days, setDays] = useState<DayId[]>(rule?.days ?? []);
  const [allProviders, setAllProviders] = useState((rule?.teamMemberIds.length ?? 0) === 0);
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>(rule?.teamMemberIds ?? []);
  const [times, setTimes] = useState<string[]>(rule?.times.length ? rule.times : [""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // side-panel-pattern — same shell/transition as every other panel.
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

  // custom-time-slots: normalizes a single typed time to "HH:MM" — accepts
  // "9", "9:45", "09:45"; left as-is (and later flagged by the save-time
  // validator) if it doesn't look like a time at all.
  function normalizeTime(raw: string): string {
    const s = raw.trim();
    const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(s);
    if (!m) return s;
    const hh = m[1].padStart(2, "0");
    const mm = m[2] ?? "00";
    return `${hh}:${mm}`;
  }

  // Lets the clinic paste/type a comma-separated batch into one row
  // ("9:45,10:30,12,14:30") and have it split into one normalized row per
  // entry, instead of typing "Añadir hora" repeatedly.
  function handleTimeChange(i: number, value: string) {
    if (value.includes(",")) {
      const parts = value.split(",").map((p) => normalizeTime(p)).filter((p) => p.length > 0);
      setTimes((ts) => {
        const next = [...ts];
        next.splice(i, 1, ...(parts.length > 0 ? parts : [""]));
        return next;
      });
      return;
    }
    setTimes((ts) => ts.map((x, idx) => (idx === i ? value : x)));
  }

  function handleTimeBlur(i: number) {
    setTimes((ts) => ts.map((x, idx) => (idx === i ? normalizeTime(x) : x)));
  }

  function toggleDay(d: DayId) {
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));
  }

  function toggleMember(id: string) {
    setTeamMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  // custom-time-slots: flags a time if it falls outside business hours on
  // ANY day the rule currently applies to — non-blocking, same convention
  // as the booking form's own dropdown flag.
  const applicableDays = allDays ? DAY_ORDER.filter((d) => (hoursByDay[d]?.length ?? 0) > 0) : days;
  function isTimeOutsideHours(t: string): boolean {
    if (!/^\d{2}:\d{2}$/.test(t)) return false;
    return applicableDays.some((d) => isOutsideBusinessHours(t, hoursByDay[d] ?? []));
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    const payload = {
      label,
      days: allDays ? [] : days,
      teamMemberIds: allProviders ? [] : teamMemberIds,
      times,
      dict: dict.errors,
    };
    try {
      const res = rule
        ? await updateCustomTimeSlotRule({ ruleId: rule.id, ...payload })
        : await createCustomTimeSlotRule(payload);
      setSaving(false);
      if (!res.ok) { setError(res.error); return; }
      requestClose(() => onSaved(res.rule));
    } catch (e) {
      setSaving(false);
      reportClientError(rule ? "updateCustomTimeSlotRule" : "createCustomTimeSlotRule", e);
      setError(dict.errUnexpected);
    }
  }

  const canSave = times.some((t) => t.trim().length > 0) && (allProviders || teamMemberIds.length > 0) && (allDays || days.length > 0);

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
          <h2 className="text-[17px] font-bold text-ink">{rule ? dict.panelTitleEdit : dict.panelTitleNew}</h2>
          <button
            onClick={close}
            aria-label={dict.close}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">{error}</div>
        )}

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ink-soft">{dict.labelLabel}</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={dict.labelPlaceholder}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] text-ink"
            />
          </label>

          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-ink-soft">{dict.daysLabel}</p>
            <div className="mb-2 flex gap-2">
              <ToggleButton active={allDays} onClick={() => setAllDays(true)} label={dict.allDays} />
              <ToggleButton active={!allDays} onClick={() => setAllDays(false)} label={dict.specificDays} />
            </div>
            {!allDays && (
              <div className="flex flex-wrap gap-1.5">
                {DAY_ORDER.map((d) => (
                  <ChipButton key={d} active={days.includes(d)} onClick={() => toggleDay(d)} label={availabilityDict.weekdaysShort[d]} />
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-ink-soft">{dict.providersLabel}</p>
            <div className="mb-2 flex gap-2">
              <ToggleButton active={allProviders} onClick={() => setAllProviders(true)} label={dict.allProviders} />
              <ToggleButton active={!allProviders} onClick={() => setAllProviders(false)} label={dict.specificProviders} />
            </div>
            {!allProviders && (
              <div className="flex flex-col gap-1">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13.5px] text-ink">
                    <input
                      type="checkbox"
                      checked={teamMemberIds.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                      className="h-4 w-4 rounded border-line"
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-ink-soft">{dict.timesLabel}</p>
            <p className="mb-2 text-[12px] text-ink-soft">{dict.timesHint}</p>
            <div className="flex flex-col gap-2">
              {times.map((t, i) => {
                const outside = isTimeOutsideHours(t);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={t}
                      onChange={(e) => handleTimeChange(i, e.target.value)}
                      onBlur={() => handleTimeBlur(i)}
                      placeholder={dict.timePlaceholder}
                      className={`w-28 rounded-lg border bg-surface px-3 py-2 text-[14px] text-ink ${
                        outside ? "border-amber-400" : "border-line"
                      }`}
                    />
                    {outside && <span className="text-[11.5px] text-amber-600">⚠ {dict.outsideHoursNote}</span>}
                    <button
                      type="button"
                      onClick={() => setTimes((ts) => ts.filter((_, idx) => idx !== i))}
                      aria-label={dict.removeTimeAria}
                      className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                );
              })}
              <Btn variant="outline" size="sm" onClick={() => setTimes((ts) => [...ts, ""])} className="self-start">
                {dict.addTimeButton}
              </Btn>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={close}
            disabled={saving}
            className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            {dict.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="rounded-lg bg-brand px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? dict.saving : dict.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        active ? "bg-brand text-white" : "border border-line bg-surface text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ChipButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors ${
        active ? "bg-brand-weak text-brand-ink border border-brand-line" : "border border-line bg-surface text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
