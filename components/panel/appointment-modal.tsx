"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { createBookingAsOwner } from "@/lib/actions/booking-owner";
import { zonedTimeToUtc, TZ } from "@/lib/calendar/client-date";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
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

/** Every hourly slot across a day's working-hours ranges — the "framework" of
 * suggested times shown as quick-pick chips. Not a restriction: the time
 * input next to them accepts any value, in or out of business hours. */
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
  dayRanges,
  dayBookings,
  intlLocale,
  services,
  members,
  dict,
  errorsDict,
  onClose,
  onCreated,
}: {
  slot: SlotSelection;
  dayRanges: TimeRangeVM[];
  dayBookings: WeekBookingVM[];
  intlLocale: string;
  services: ServiceVM[];
  members: MemberVM[];
  dict: CalendarDictionary["modal"];
  errorsDict: CalendarDictionary["manualErrors"];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [teamMemberId, setTeamMemberId] = useState(slot.teamMemberId);
  const [timeStr, setTimeStr] = useState(slot.initialTime);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedTimes = useMemo(() => buildSuggestedTimes(dayRanges), [dayRanges]);
  const timeValid = /^\d{2}:\d{2}$/.test(timeStr);
  const isOutsideHours = timeValid && !suggestedTimes.includes(timeStr);

  const startDate = useMemo(() => {
    if (!timeValid) return null;
    const [hh, mm] = timeStr.split(":").map(Number);
    return zonedTimeToUtc(slot.dayYear, slot.dayMonth, slot.dayDay, hh, mm);
  }, [timeValid, timeStr, slot.dayYear, slot.dayMonth, slot.dayDay]);

  const selectedService = services.find((s) => s.id === serviceId);
  const durationMin = selectedService?.durationMin ?? 30;

  const conflict = useMemo(() => {
    if (!startDate) return false;
    const startMs = startDate.getTime();
    const endMs = startMs + durationMin * 60_000;
    return dayBookings.some((b) => {
      if (b.teamMemberId !== teamMemberId) return false;
      if (b.status !== "pending_confirmation" && b.status !== "confirmed") return false;
      const bStart = new Date(b.startIso).getTime();
      const bEnd = new Date(b.endIso).getTime();
      return bStart < endMs && bEnd > startMs;
    });
  }, [startDate, durationMin, teamMemberId, dayBookings]);

  const dateLabel = useMemo(() => {
    const base = startDate ?? zonedTimeToUtc(slot.dayYear, slot.dayMonth, slot.dayDay, 12, 0);
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: TZ, weekday: "long", day: "numeric", month: "long",
    }).format(base);
  }, [startDate, slot.dayYear, slot.dayMonth, slot.dayDay, intlLocale]);

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

        <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-[13px] font-medium capitalize text-ink">
          {dateLabel}
        </p>

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

          <Field label={dict.timeLabel}>
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className={`w-full rounded-lg border bg-surface px-3 py-2 text-[14px] text-ink ${
                conflict ? "border-error" : "border-line"
              }`}
            />
            {isOutsideHours && !conflict && (
              <span className="mt-1 text-[12px] text-ink-soft">{dict.outsideHoursNote}</span>
            )}
          </Field>

          {suggestedTimes.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-ink-soft">{dict.suggestedSlotsLabel}</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedTimes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeStr(t)}
                    className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                      t === timeStr
                        ? "border-brand bg-brand-weak text-brand-ink"
                        : "border-line text-ink-soft hover:bg-surface-2"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
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
            disabled={submitting || !clientName.trim() || !serviceId || !timeValid || conflict}
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
