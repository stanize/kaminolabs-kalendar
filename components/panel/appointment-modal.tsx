"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { createBookingAsOwner } from "@/lib/actions/booking-owner";
import { searchClients, updateClientContactInfo, addClientNote, type ClientSearchResult } from "@/lib/actions/clients";
import { reportClientError } from "@/lib/report-client-error";
import { zonedTimeToUtc, dayIdInTz, tzDateParts } from "@/lib/calendar/client-date";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { DayId } from "@/lib/onboarding/types";
import type { WeekBookingVM } from "@/components/panel/calendar-grid-view";
import {
  ClientProfileTabs,
  EMPTY_STAGED_CLIENT_FIELDS,
  TAB_ORDER,
  TAB_LABEL,
  type FullTab,
} from "@/components/panel/client-profile-tabs";
import {
  type ServiceVM,
  type MemberVM,
  type TimeRangeVM,
  toMinutes,
  ymd,
  buildSuggestedTimes,
} from "@/lib/booking/appointment-fields";

// A client-safe projection of BusinessClosure (lib/closures/data.ts) — just
// the fields needed to check whether a picked date/time falls on a festivo
// or provider time off. Fetched once at the page level, same as hoursByDay.
export interface ClosureRuleVM {
  teamMemberId: string | null; // null = clinic-wide
  recurring: boolean;
  month: number | null;
  day: number | null;
  startDate: string | null; // "YYYY-MM-DD"
  endDate: string | null;
  startTime: string | null; // "HH:MM" or "HH:MM:SS"
  endTime: string | null;
  label: string | null;
}

export interface SlotSelection {
  dayYear: number;
  dayMonth: number;
  dayDay: number;
  initialTime: string; // "HH:MM" — the slot that was clicked, editable from here on
  teamMemberId: string;
  providerName: string;
}

// appointment-panel-tabs (2026-10): this component is CREATE-ONLY now — its
// old "edit" mode (`mode: "edit"`, reusing this same form to modify an
// existing booking) was superseded by detail-panel-inline-edit, which
// folded appointment editing straight into BookingDetailModal. Nothing
// called `mode="edit"` anymore (verified: no call sites left), so the
// union/isEdit branching was dead weight — removed rather than carried
// forward, same session convention as everywhere else dead code gets
// found.
interface AppointmentModalProps {
  slot: SlotSelection;
  hoursByDay: Partial<Record<DayId, TimeRangeVM[]>>;
  allBookings: WeekBookingVM[];
  services: ServiceVM[];
  members: MemberVM[];
  closures: ClosureRuleVM[];
  dict: CalendarDictionary;
  errorsDict: CalendarDictionary["manualErrors"];
  whatsappEnabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function AppointmentModal({
  slot, hoursByDay, allBookings, services, members, closures, dict, errorsDict, whatsappEnabled, onClose, onSaved,
}: AppointmentModalProps) {
  const md = dict.modal;
  const ct = dict.clientTabs;
  const [activeTab, setActiveTab] = useState<FullTab>("cita");
  const [staged, setStaged] = useState(EMPTY_STAGED_CLIENT_FIELDS);

  const initialDateParts = { year: slot.dayYear, month: slot.dayMonth, day: slot.dayDay };

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [teamMemberId, setTeamMemberId] = useState(slot.teamMemberId);
  const [dateStr, setDateStr] = useState(ymd(initialDateParts.year, initialDateParts.month, initialDateParts.day));
  const [timeStr, setTimeStr] = useState(slot.initialTime);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  // client-linking-on-booking: set when the owner picks an existing client
  // from the search results below; cleared the moment they type anything
  // afterward, since editing the fields after picking means they're now
  // diverging from that client's stored data — safer to fall back to
  // creating a fresh kalendar_clients row than silently keep a stale link.
  // Also drives the Cliente/Historial/Notas tabs below: set = those tabs
  // show the real picked client live; null = a brand-new client, tabs
  // operate on `staged` instead (see client-profile-tabs.tsx).
  const [clinicClientId, setClinicClientId] = useState<string | null>(null);
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [showClientResults, setShowClientResults] = useState(false);
  const clientSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeMenuOpen, setTimeMenuOpen] = useState(false);

  // side-panel-pattern (first rollout, 2026-10): slides in from the right
  // over the main content area (leaving the sidebar visible on desktop,
  // handled by the wrapper's `md:left-[240px]` backdrop inset below)
  // instead of the old centered modal. `visible` drives the transform —
  // starts closed, flips open one frame after mount so the transition
  // actually runs, and flips closed again before telling the parent to
  // unmount us, so the close has the same slide animation as the open.
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

  // Auto-check behavior for the two confirmation checkboxes: each starts
  // unchecked and auto-checks itself the moment its field transitions from
  // empty to non-empty (typing the first character). Tracked with a ref
  // (not derived from state) so a later manual uncheck is never fought —
  // only the transition triggers the auto-check, not every keystroke
  // afterward.
  const prevEmailEmptyRef = useRef(true);
  const prevPhoneEmptyRef = useRef(true);

  useEffect(() => {
    const isEmptyNow = clientEmail.trim().length === 0;
    if (prevEmailEmptyRef.current && !isEmptyNow) setSendEmail(true);
    prevEmailEmptyRef.current = isEmptyNow;
  }, [clientEmail]);

  useEffect(() => {
    const isEmptyNow = clientPhone.trim().length === 0;
    if (prevPhoneEmptyRef.current && !isEmptyNow) setSendWhatsapp(true);
    prevPhoneEmptyRef.current = isEmptyNow;
  }, [clientPhone]);

  // client-linking-on-booking: type-ahead search on the name field.
  // Debounced to avoid a request per keystroke; the "clear results" case
  // is also inside the timeout (not called synchronously in the effect
  // body) to avoid the cascading-render setState-in-effect pattern.
  useEffect(() => {
    if (clientSearchDebounceRef.current) clearTimeout(clientSearchDebounceRef.current);
    const q = clientName.trim();
    clientSearchDebounceRef.current = setTimeout(async () => {
      if (q.length < 1) {
        setClientResults([]);
        setShowClientResults(false);
        return;
      }
      try {
        const results = await searchClients(q);
        setClientResults(results);
        setShowClientResults(results.length > 0);
      } catch (e) {
        reportClientError("searchClients", e);
      }
    }, 300);
    return () => {
      if (clientSearchDebounceRef.current) clearTimeout(clientSearchDebounceRef.current);
    };
  }, [clientName]);

  function selectExistingClient(c: ClientSearchResult) {
    setClientName(c.name);
    setClientEmail(c.email ?? "");
    setClientPhone(c.phone ?? "");
    setClinicClientId(c.id);
    setShowClientResults(false);
  }

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

  // holidays-and-time-off: a manual booking is still ALLOWED to override a
  // festivo/provider-time-off (unlike `conflict` above, which blocks a
  // double-booking) — this is a non-blocking heads-up only, matching the
  // Conflictos tab's "clinic can override" decision. Checked against the
  // whole closures list (not just the currently-conflicting ones from the
  // Conflictos tab) since this is picking a NEW date/time, possibly one
  // that has no existing bookings yet.
  const closureWarningLabel = useMemo(() => {
    if (!selectedDateParts) return null;
    const dateStr = ymd(selectedDateParts.year, selectedDateParts.month, selectedDateParts.day);
    const apptStart = timeValid ? toMinutes(timeStr) : null;
    const apptEnd = apptStart !== null ? apptStart + durationMin : null;
    for (const c of closures) {
      if (c.teamMemberId && c.teamMemberId !== teamMemberId) continue;
      if (c.recurring) {
        if (c.month === selectedDateParts.month && c.day === selectedDateParts.day) {
          return c.label || md.closureGenericLabel;
        }
        continue;
      }
      if (!c.startDate || !c.endDate) continue;
      if (dateStr < c.startDate || dateStr > c.endDate) continue;
      if (c.startTime && c.endTime && apptStart !== null && apptEnd !== null) {
        const cStart = toMinutes(c.startTime);
        const cEnd = toMinutes(c.endTime);
        if (apptStart >= cEnd || apptEnd <= cStart) continue; // no overlap
      }
      return c.label || md.closureGenericLabel;
    }
    return null;
  }, [selectedDateParts, timeStr, timeValid, durationMin, teamMemberId, closures, md.closureGenericLabel]);

  const handleSubmit = async () => {
    setError(null);
    if (!serviceId || !teamMemberId || !startDate || conflict) return;
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
          sendConfirmationWhatsapp: whatsappEnabled && sendWhatsapp,
          clinicClientId: clinicClientId || undefined,
        },
        errorsDict
      );
      if (!res.ok) {
        setError(res.error);
        setSubmitting(false);
        return;
      }

      // appointment-panel-tabs: a BRAND-NEW client (nothing picked from
      // the search above) only gets a real kalendar_clients row the
      // moment createBookingAsOwner makes one — apply whatever was typed
      // into the staged Cliente/Notas tabs now, using that id. An
      // EXISTING picked client already wrote any edits live (through
      // ClientProfileTabs itself, below), so `staged` stays untouched in
      // that case and this is a no-op. Best-effort, same as every other
      // clinic_client_id-dependent side effect in this codebase — never
      // blocks the appointment, which already succeeded above.
      if (!clinicClientId && res.clinicClientId) {
        const hasStagedFields = staged.dni || staged.address || staged.dateOfBirth;
        try {
          if (hasStagedFields) {
            await updateClientContactInfo({
              clientId: res.clinicClientId,
              name: clientName,
              email: clientEmail,
              phone: clientPhone,
              dni: staged.dni,
              address: staged.address,
              dateOfBirth: staged.dateOfBirth,
            });
          }
          if (staged.note.trim()) {
            await addClientNote({ clientId: res.clinicClientId, body: staged.note.trim() });
          }
        } catch (e) {
          reportClientError("applyStagedClientFields", e);
        }
      }

      requestClose(onSaved);
    } catch (e) {
      reportClientError("createBookingAsOwner", e);
      setError(errorsDict.errCreateFailed);
      setSubmitting(false);
    }
  };

  const close = () => requestClose(onClose);

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
          <h2 className="text-[17px] font-bold text-ink">{md.title}</h2>
          <button
            onClick={close}
            aria-label={md.close}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* appointment-panel-tabs */}
        <div className="mb-4 flex gap-1 border-b border-line">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${
                activeTab === tab ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {TAB_LABEL[tab](ct)}
            </button>
          ))}
        </div>

        {activeTab !== "cita" && (
          <ClientProfileTabs
            activeTab={activeTab}
            clientId={clinicClientId}
            staged={staged}
            onStagedChange={setStaged}
            dict={ct}
          />
        )}

        {activeTab === "cita" && <>
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
          <Field label={md.serviceLabel}>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[16px] text-ink"
            >
              {services.length === 0 && <option value="">{md.servicePlaceholder}</option>}
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.durationMin} min
                </option>
              ))}
            </select>
          </Field>

          {members.length > 1 && (
            <Field label={md.providerLabel}>
              <select
                value={teamMemberId}
                onChange={(e) => setTeamMemberId(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[16px] text-ink"
              >
                {/* multi-provider-calendar-display: a click from the merged
                    Week view arrives with no provider defaulted
                    (teamMemberId === "") — this placeholder forces an
                    explicit choice instead of silently landing on members[0]. */}
                {!teamMemberId && <option value="">{md.providerPlaceholder}</option>}
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Field label={md.dateLabel}>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[16px] text-ink"
                />
              </Field>
            </div>
            <div className="relative flex-1">
              <Field label={md.timeLabel}>
                <input
                  type="text"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  onFocus={() => setTimeMenuOpen(true)}
                  onBlur={() => setTimeMenuOpen(false)}
                  placeholder="HH:MM"
                  autoComplete="off"
                  className={`w-full rounded-lg border bg-surface px-3 py-2 text-[16px] text-ink ${
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
            <span className="-mt-2 text-[12px] text-ink-soft">{md.outsideHoursNote}</span>
          )}
          {closureWarningLabel && !conflict && (
            <span className="-mt-2 text-[12px] text-amber-600">
              {md.closureWarningNote.replace("{label}", closureWarningLabel)}
            </span>
          )}

          <Field label={md.clientNameLabel}>
            <div className="relative">
              <input
                value={clientName}
                onChange={(e) => { setClientName(e.target.value); setClinicClientId(null); }}
                onFocus={() => setShowClientResults(clientResults.length > 0)}
                onBlur={() => setTimeout(() => setShowClientResults(false), 150)}
                placeholder={md.clientNamePlaceholder}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[16px] text-ink"
                autoComplete="off"
              />
              {clinicClientId && (
                <span
                  title="Cliente existente"
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-brand-weak px-2 py-0.5 text-[11px] font-semibold text-brand-ink"
                >
                  <Icon name="check" size={11} className="mr-0.5 inline" strokeWidth={3} />
                  Cliente
                </span>
              )}
              {showClientResults && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
                  {clientResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()} // keep focus so onBlur doesn't fire first
                      onClick={() => selectExistingClient(c)}
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-surface-2"
                    >
                      <span className="text-[13.5px] font-semibold text-ink">{c.name}</span>
                      <span className="text-[12px] text-ink-soft">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "Sin contacto"}
                        {c.totalSessions > 0 ? ` · ${c.totalSessions} cita${c.totalSessions === 1 ? "" : "s"}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field label={md.clientEmailLabel}>
            <input
              value={clientEmail}
              onChange={(e) => { setClientEmail(e.target.value); setClinicClientId(null); }}
              placeholder={md.clientEmailPlaceholder}
              type="email"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[16px] text-ink"
            />
          </Field>

          <Field label={md.clientPhoneLabel}>
            <input
              value={clientPhone}
              onChange={(e) => { setClientPhone(e.target.value); setClinicClientId(null); }}
              placeholder={md.clientPhonePlaceholder}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[16px] text-ink"
            />
          </Field>

          <Field label={md.notesLabel}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={md.notesPlaceholder}
              rows={2}
              className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[16px] text-ink"
            />
          </Field>

          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            {md.sendEmailLabel}
          </label>

          {whatsappEnabled && (
            <label className="flex items-center gap-2 text-[13px] text-ink-soft">
              <input
                type="checkbox"
                checked={sendWhatsapp}
                onChange={(e) => setSendWhatsapp(e.target.checked)}
                className="h-4 w-4 rounded border-line"
              />
              {md.sendWhatsappLabel}
            </label>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={close}
            disabled={submitting}
            className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            {md.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !clientName.trim() || !serviceId || !teamMemberId || !dateValid || !timeValid || conflict}
            className="rounded-lg bg-brand px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? md.submitting : md.submit}
          </button>
        </div>
        </>}
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
