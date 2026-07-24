"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { createBookingAsOwner } from "@/lib/actions/booking-owner";
import { zonedTimeToUtc, dayIdInTz, tzDateParts } from "@/lib/calendar/client-date";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { DayId } from "@/lib/onboarding/types";
import type { WeekBookingVM } from "@/components/panel/calendar-grid-view";

interface ServiceVM {
  id: string;
  name: string;
  durationMin: number;
  price: number;
}

interface MemberVM {
  id: string;
  name: string;
}

interface TimeRangeVM {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export interface SlotSelection {
  dayYear: number;
  dayMonth: number;
  dayDay: number;
  initialTime: string; // "HH:MM" — the slot that was clicked, editable from here on
  teamMemberId: string;
  providerName: string;
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Every hourly slot across a day's working-hours ranges — offered in the
 * time field's dropdown as a convenience, not a restriction: the field
 * itself accepts any typed value too, in or out of business hours. */
function buildSuggestedTimes(ranges: TimeRangeVM[]): string[] {
  const times: string[] = [];
  for (const r of ranges) {
    const [sh, sm] = r.start.split(":").map(Number);
    const [eh, em] = r.end.split(":").map(Number);
    let t = sh * 60 + sm;
    const end = eh * 60 + em;
    while (t < end) {
      times.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
      t += 60;
    }
  }
  return times;
}

export function AppointmentModal({
  slot,
  hoursByDay,
  allBookings,
  services,
  members,
  dict,
  errorsDict,
  onClose,
  onCreated,
}: {
  slot: SlotSelection;
  hoursByDay: Partial<Record<DayId, TimeRangeVM[]>>;
  allBookings: WeekBookingVM[];
  services: ServiceVM[];
  members: MemberVM[];
  dict: CalendarDictionary["modal"];
  errorsDict: CalendarDictionary["manualErrors"];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [teamMemberId, setTeamMemberId] = useState(slot.teamMemberId);
  const [dateStr, setDateStr] = useState(ymd(slot.dayYear, slot.dayMonth, slot.dayDay));
  const [timeStr, setTimeStr] = useState(slot.initialTime);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeMenuOpen, setTimeMenuOpen] = useState(false);

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const timeValid = /^\d{2}:\d{2}$/.test(timeStr);

  const selectedDateParts = useMemo(() => {
    if (!dateValid) return null;
    const [y, m, d] = dateStr.split("-").map(Number);
    return { year: y, month: m, day: d };
  }, [dateValid, dateStr]);

  // Ranges/bookings for whichever date is currently selected — recomputed
  // reactively so changing the date (not just the time) stays accurate,
  // instead of being pinned to the originally-clicked day's data.
  const selectedDayRanges = useMemo(() => {
    if (!selectedDateParts) return [];
    const dayId = dayIdInTz(zonedTimeToUtc(selectedDateParts.year, selectedDateParts.month, selectedDateParts.day, 12, 0));
    return hoursByDay[dayId] ?? [];
  }, [selectedDateParts, hoursByDay]);

  const selectedDayBookings = useMemo(() => {
    if (!selectedDateParts) return [];
    return allBookings.filter((b) => {
      const p = tzDateParts(new Date(b.startIso));
      return p.year === selectedDateParts.year && p.month === selectedDateParts.month && p.day === selectedDateParts.day;
    });
  }, [selectedDateParts, allBookings]);

  const suggestedTimes = useMemo(() => buildSuggestedTimes(selectedDayRanges), [selectedDayRanges]);
  const isOutsideHours = timeValid && !suggestedTimes.includes(timeStr);

  const startDate = useMemo(() => {
    if (!selectedDateParts || !timeValid) return null;
    const [hh, mm] = timeStr.split(":").map(Number);
    return zonedTimeToUtc(selectedDateParts.year, selectedDateParts.month, selectedDateParts.day, hh, mm);
  }, [selectedDateParts, timeValid, timeStr]);

  const selectedService = services.find((s) => s.id === serviceId);
  const durationMin = selectedService?.durationMin ?? 30;

  const isTimeTaken = useMemo(() => {
    return (candidate: string): boolean => {
      if (!selectedDateParts) return false;
      const [hh, mm] = candidate.split(":").map(Number);
      const start = zonedTimeToUtc(selectedDateParts.year, selectedDateParts.month, selectedDateParts.day, hh, mm);
      const startMs = start.getTime();
      const endMs = startMs + durationMin * 60_000;
      return selectedDayBookings.some((b) => {
        if (b.teamMemberId !== teamMemberId) return false;
        if (b.status !== "pending_confirmation" && b.status !== "confirmed") return false;
        const bStart = new Date(b.startIso).getTime();
        const bEnd = new Date(b.endIso).getTime();
        return bStart < endMs && bEnd > startMs;
      });
    };
  }, [selectedDateParts, durationMin, teamMemberId, selectedDayBookings]);

  const conflict = timeValid ? isTimeTaken(timeStr) : false;

  const handleSubmit = async () => {
    setError(null);
    if (!serviceId || !startDate || conflict) return;
    setSubmitting(true);
    try {
      const res = await createBookingAsOwner(
        {
          serviceId,
          teamMemberId,
          startIso: startDate.toISOString(),
          clientName,
          clientEmail: clientEmail || undefined,
          clientPhone: clientPhone || undefined,
          notes: notes || undefined,
          sendConfirmationEmail: sendEmail,
        },
        errorsDict
      );
      if (!res.ok) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      onCreated();
    } catch {
      setError(errorsDict.errCreateFailed);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[440px] rounded-2xl bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-ink">{dict.title}</h2>
          <button
            onClick={onClose}
            aria-label={dict.close}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">
            {error}
          </div>
        )}

        {!error && conflict && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">
            {errorsDict.errSlotTaken}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Field label={dict.serviceLabel}>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            >
              {services.length === 0 && <option value="">{dict.servicePlaceholder}</option>}
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.durationMin} min
                </option>
              ))}
            </select>
          </Field>

          {members.length > 1 && (
            <Field label={dict.providerLabel}>
              <select
                value={teamMemberId}
                onChange={(e) => setTeamMemberId(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <Field label={dict.dateLabel}>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
                />
              </Field>
            </div>
            <div className="relative flex-1">
              <Field label={dict.timeLabel}>
                <input
                  type="text"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  onFocus={() => setTimeMenuOpen(true)}
                  onBlur={() => setTimeMenuOpen(false)}
                  placeholder="HH:MM"
                  autoComplete="off"
                  className={`w-full rounded-lg border bg-surface px-3 py-2 text-[14px] text-ink ${
                    conflict ? "border-error" : "border-line"
                  }`}
                />
              </Field>
              {timeMenuOpen && suggestedTimes.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[220px] overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
                  {suggestedTimes.map((t) => {
                    const taken = isTimeTaken(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        // onMouseDown (not onClick) fires before the input's onBlur closes the menu
                        onMouseDown={() => setTimeStr(t)}
                        className={`block w-full px-3 py-1.5 text-left text-[13.5px] hover:bg-surface-2 ${
                          taken ? "text-ink-soft" : "font-bold text-green-600"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {isOutsideHours && !conflict && (
            <span className="-mt-2 text-[12px] text-ink-soft">{dict.outsideHoursNote}</span>
          )}

          <Field label={dict.clientNameLabel}>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={dict.clientNamePlaceholder}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            />
          </Field>

          <Field label={dict.clientEmailLabel}>
            <input
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder={dict.clientEmailPlaceholder}
              type="email"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            />
          </Field>

          <Field label={dict.clientPhoneLabel}>
            <input
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder={dict.clientPhonePlaceholder}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            />
          </Field>

          <Field label={dict.notesLabel}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={dict.notesPlaceholder}
              rows={2}
              className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            />
          </Field>

          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={sendEmail}
              disabled={!clientEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            {dict.sendEmailLabel}
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            {dict.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !clientName.trim() || !serviceId || !dateValid || !timeValid || conflict}
            className="rounded-lg bg-brand px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? dict.submitting : dict.submit}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12.5px] font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
