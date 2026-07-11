"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { createBookingAsOwner } from "@/lib/actions/booking-owner";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";

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

export interface SlotSelection {
  startIso: string;
  dateTimeLabel: string; // pre-formatted for display, e.g. "lunes, 15 de julio · 10:00"
  teamMemberId: string;
  providerName: string;
}

export function AppointmentModal({
  slot,
  services,
  members,
  dict,
  errorsDict,
  onClose,
  onCreated,
}: {
  slot: SlotSelection;
  services: ServiceVM[];
  members: MemberVM[];
  dict: CalendarDictionary["modal"];
  errorsDict: CalendarDictionary["manualErrors"];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [teamMemberId, setTeamMemberId] = useState(slot.teamMemberId);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!serviceId) return;
    setSubmitting(true);
    try {
      const res = await createBookingAsOwner(
        {
          serviceId,
          teamMemberId,
          startIso: slot.startIso,
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
          {slot.dateTimeLabel}
        </p>

        {error && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">
            {error}
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
            disabled={submitting || !clientName.trim() || !serviceId}
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
