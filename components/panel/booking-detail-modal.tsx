"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { cancelBookingAsOwner, updateBookingResult, type BookingResultStatus, type BookingPaymentStatus } from "@/lib/actions/booking-owner";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { WeekBookingVM } from "@/components/panel/calendar-grid-view";

const TZ = "Europe/Madrid";

export function BookingDetailModal({
  booking,
  intlLocale,
  dict,
  errorsDict,
  onClose,
  onUpdated,
}: {
  booking: WeekBookingVM;
  intlLocale: string;
  dict: CalendarDictionary["detailModal"];
  errorsDict: CalendarDictionary["errors"];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialResult: BookingResultStatus | null =
    booking.status === "completed" || booking.status === "no_show" || booking.status === "cancelled"
      ? booking.status
      : null;
  const [result, setResult] = useState<BookingResultStatus | null>(initialResult);
  const [payment, setPayment] = useState<BookingPaymentStatus>(booking.paymentStatus);
  const isDirty = result !== initialResult || payment !== booking.paymentStatus;

  const isFuture = new Date(booking.startIso) > new Date();
  const hasRealEmail = booking.clientEmail && !booking.clientEmail.startsWith("sin-email+");

  const dateTimeLabel = new Intl.DateTimeFormat(intlLocale, {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date(booking.startIso));

  const handleCancel = async () => {
    setBusy(true);
    setError(null);
    const res = await cancelBookingAsOwner(booking.id, errorsDict);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    onClose();
  };

  const handleSaveResult = async () => {
    if (!result) return;
    setBusy(true);
    setError(null);
    const res = await updateBookingResult(
      { bookingId: booking.id, status: result, paymentStatus: payment },
      errorsDict
    );
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-ink">{booking.serviceName}</h2>
          <button
            onClick={onClose}
            aria-label={dict.close}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-1.5 rounded-xl bg-surface-2/50 px-3.5 py-3 text-[13.5px]">
          <div className="flex items-center gap-2 text-ink">
            <Icon name="calendar" size={14} className="shrink-0 text-ink-soft" />
            <span className="capitalize">{dateTimeLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-ink">
            <Icon name="user" size={14} className="shrink-0 text-ink-soft" />
            <span>{booking.clientName}</span>
          </div>
          {booking.clientPhone && (
            <div className="flex items-center gap-2 text-ink-soft">
              <Icon name="phone" size={14} className="shrink-0" />
              <span>{booking.clientPhone}</span>
            </div>
          )}
          {hasRealEmail && (
            <div className="flex items-center gap-2 text-ink-soft">
              <Icon name="mail" size={14} className="shrink-0" />
              <span className="truncate">{booking.clientEmail}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[13px] text-error">
            {error}
          </div>
        )}

        {isFuture ? (
          <div className="flex justify-end">
            <Btn variant="outline" onClick={handleCancel} disabled={busy}>
              {busy ? dict.cancelling : dict.cancelButton}
            </Btn>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
                {dict.resultLabel}
              </p>
              <div className="flex gap-1.5">
                <ChoiceBtn active={result === "completed"} onClick={() => setResult("completed")} label={dict.resultCompleted} />
                <ChoiceBtn active={result === "no_show"} onClick={() => setResult("no_show")} label={dict.resultNoShow} />
                <ChoiceBtn active={result === "cancelled"} onClick={() => setResult("cancelled")} label={dict.resultCancelled} />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
                {dict.paymentLabel}
              </p>
              <div className="flex gap-1.5">
                <ChoiceBtn active={payment === "paid"} onClick={() => setPayment("paid")} label={dict.paymentPaid} />
                <ChoiceBtn active={payment === "unpaid"} onClick={() => setPayment("unpaid")} label={dict.paymentPending} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={onClose} disabled={busy}>
                {dict.dismissButton}
              </Btn>
              <Btn onClick={handleSaveResult} disabled={busy || !result || !isDirty}>
                {busy ? dict.saving : dict.saveButton}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChoiceBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg border px-2.5 py-2 text-[12.5px] font-semibold transition-colors ${
        active ? "border-brand bg-brand-weak text-brand-ink" : "border-line text-ink-soft hover:bg-surface-2"
      }`}
    >
      {label}
    </button>
  );
}
