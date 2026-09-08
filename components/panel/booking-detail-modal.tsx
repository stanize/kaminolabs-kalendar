"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import {
  cancelBookingAsOwner,
  confirmBookingAsOwner,
  updateBookingResult,
  reviewCancellationRequest,
  type BookingResultStatus,
  type BookingPaymentStatus,
  type BookingPaymentMethod,
} from "@/lib/actions/booking-owner";
import { getActiveBonosForClientAction } from "@/lib/actions/bonos";
import type { ClientActiveBono } from "@/lib/bonos/data";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import { CLIENT_STATUS_LABEL, CLIENT_STATUS_BADGE_CLASS, type WeekBookingVM } from "@/components/panel/calendar-grid-view";

const TZ = "Europe/Madrid";

export function BookingDetailModal({
  booking,
  intlLocale,
  dict,
  onClose,
  onUpdated,
  onModify,
  onCancellationReviewed,
}: {
  booking: WeekBookingVM;
  intlLocale: string;
  dict: CalendarDictionary;
  onClose: () => void;
  onUpdated: () => void;
  onModify: (booking: WeekBookingVM) => void;
  // Fired specifically after a successful approve/deny — distinct from
  // onUpdated (which just refetches the grid) because the caller may also
  // be showing this booking in a separate flat list (e.g. the calendar
  // page's Cancelaciones tab) that needs its own local state updated too,
  // and onUpdated alone doesn't tell the caller WHICH action succeeded —
  // e.g. saving a Resultado on a booking that also happens to have an
  // unrelated pending cancellation request shouldn't clear that request
  // from such a list, only an actual approve/deny should.
  onCancellationReviewed?: () => void;
}) {
  const d = dict.detailModal;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialResult: BookingResultStatus | null =
    booking.status === "completed" || booking.status === "no_show" || booking.status === "cancelled"
      ? booking.status
      : null;
  const [result, setResult] = useState<BookingResultStatus | null>(initialResult);
  const [payment, setPayment] = useState<BookingPaymentStatus>(booking.paymentStatus);

  // ── Payment method (session-deduction-on-payment, bonos.md) ──────────────
  // "" = not chosen yet, "cash" / "card", or `bono:<purchaseId>`. Derived
  // from the booking's CURRENT saved method — this is also what "locked"
  // compares against, since the lock is about the value already saved on
  // this booking, not whatever the owner is mid-editing.
  const initialMethod: string =
    booking.paymentMethod === "cash"
      ? "cash"
      : booking.paymentMethod === "card"
        ? "card"
        : booking.paymentMethod === "bono" && booking.bonoPurchaseId
          ? `bono:${booking.bonoPurchaseId}`
          : "";
  // Switching AWAY from an already-applied bono (to cash, card, or a
  // different bono) can only happen from the Bonos page — see
  // session-deduction-on-payment. Switching INTO a bono, or between
  // cash/card, stays freely editable here.
  const locked = booking.paymentMethod === "bono" && !!booking.bonoPurchaseId;

  const [methodChoice, setMethodChoice] = useState<string>(initialMethod);
  const [methodTouched, setMethodTouched] = useState(false);
  const [activeBonos, setActiveBonos] = useState<ClientActiveBono[] | null>(null);
  const [bonosLoading, setBonosLoading] = useState(false);

  // Fetched lazily — only once payment is actually toggled to "paid" (or
  // was already paid on open), never for the common unpaid case, and only
  // once per modal open.
  useEffect(() => {
    if (payment !== "paid" || !booking.clinicClientId || activeBonos !== null || bonosLoading) return;
    let cancelled = false;
    async function loadBonos(clientId: string) {
      setBonosLoading(true);
      const bonos = await getActiveBonosForClientAction({ clientId });
      if (cancelled) return;
      setActiveBonos(bonos);
      setBonosLoading(false);
    }
    loadBonos(booking.clinicClientId);
    return () => {
      cancelled = true;
    };
  }, [payment, booking.clinicClientId, activeBonos, bonosLoading]);

  // DECIDED default: if the client has an active bono, the OLDEST one
  // (activeBonos is already ordered oldest-first) is pre-selected — but
  // only when the owner hasn't chosen anything yet (fresh "mark as paid",
  // not re-opening an already cash/card/bono-paid booking) and hasn't
  // manually touched the dropdown themselves. Derived rather than synced
  // via an effect, since it's a pure function of already-known state.
  const effectiveMethodChoice =
    methodTouched || initialMethod !== "" || locked
      ? methodChoice
      : activeBonos === null
        ? ""
        : activeBonos.length > 0
          ? `bono:${activeBonos[0].id}`
          : "cash";

  const isDirty =
    result !== initialResult ||
    payment !== booking.paymentStatus ||
    (payment === "paid" && effectiveMethodChoice !== initialMethod);
  // Can't save a "paid" state until a method is actually resolved (covers
  // the brief window while activeBonos is still loading).
  const methodReady = payment !== "paid" || effectiveMethodChoice !== "";

  const isFuture = new Date(booking.startIso) > new Date();
  // Only a GUEST booking's pending_confirmation is something the owner
  // should confirm/cancel — a patient's own pending_confirmation (created
  // because their email/password sign-up wasn't verified yet) resolves
  // itself automatically the moment they verify (see finalizeVerifiedPatientBookings
  // in lib/actions/patient.ts). Showing Confirmar here would let an owner
  // click through and force-confirm an unverified account's booking,
  // defeating the whole point of gating it. clientStatus is already
  // patient_id-derived (see lib/booking/client-status.ts) — a guest booking
  // is 'guest_unconfirmed'/'guest_confirmed', a patient-linked one is
  // 'first_time'/'returning', so this is a free, zero-schema-change signal.
  const isAwaitingConfirmation = booking.status === "pending_confirmation" && booking.clientStatus === "guest_unconfirmed";
  const hasRealEmail = booking.clientEmail && !booking.clientEmail.startsWith("sin-email+");

  const dateTimeLabel = new Intl.DateTimeFormat(intlLocale, {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date(booking.startIso));

  const handleCancel = async () => {
    setBusy(true);
    setError(null);
    const res = await cancelBookingAsOwner(booking.id, dict.errors);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    onClose();
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    const res = await confirmBookingAsOwner(booking.id, dict.errors);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    onClose();
  };

  const handleReviewRequest = async (decision: "approve" | "deny") => {
    setBusy(true);
    setError(null);
    const res = await reviewCancellationRequest(booking.id, decision, dict.errors);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    onCancellationReviewed?.();
    onClose();
  };

  const handleSaveResult = async () => {
    if (!result) return;
    setBusy(true);
    setError(null);
    let paymentMethod: BookingPaymentMethod | undefined;
    if (payment === "paid") {
      paymentMethod = effectiveMethodChoice.startsWith("bono:")
        ? { bonoPurchaseId: effectiveMethodChoice.slice("bono:".length) }
        : (effectiveMethodChoice as "cash" | "card");
    }
    const res = await updateBookingResult(
      { bookingId: booking.id, status: result, paymentStatus: payment, paymentMethod },
      dict.errors
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
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[17px] font-bold text-ink">{booking.serviceName}</h2>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CLIENT_STATUS_BADGE_CLASS[booking.clientStatus]}`}>
              {CLIENT_STATUS_LABEL[booking.clientStatus]}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={d.close}
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
          {isAwaitingConfirmation && (
            <div className="flex items-center gap-2 text-orange-700">
              <Icon name="bell" size={14} className="shrink-0" />
              <span className="font-semibold">Pendiente de confirmación</span>
            </div>
          )}
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
          {booking.reminderSendFailed && (
            <div className="flex items-center gap-2 text-amber-700" title={booking.lastReminderError ?? undefined}>
              <Icon name="bell" size={14} className="shrink-0" />
              <span className="font-semibold">
                Recordatorio no enviado{booking.lastReminderError ? `: ${booking.lastReminderError}` : ""}
              </span>
            </div>
          )}
        </div>

        {booking.notes && (
          <div className="mb-4 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px]">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink-soft">
              <Icon name="fileText" size={13} className="shrink-0" />
              {d.notesLabel}
            </p>
            <p className="whitespace-pre-wrap text-ink">{booking.notes}</p>
          </div>
        )}

        {booking.cancellationRequestedAt && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-[13.5px] font-semibold text-rose-800">
              <Icon name="bell" size={14} className="shrink-0" />
              Solicitud de cancelación pendiente
            </p>
            <p className="mb-3 text-[12.5px] text-rose-700">
              El cliente ha pedido cancelar esta cita, pero está dentro de tu ventana de
              cancelación y necesita tu aprobación. La cita sigue reservada mientras decides.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleReviewRequest("approve")}
                disabled={busy}
                className="flex-1 rounded-lg bg-error px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:brightness-95 disabled:opacity-60"
              >
                Aprobar cancelación
              </button>
              <button
                type="button"
                onClick={() => handleReviewRequest("deny")}
                disabled={busy}
                className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-60"
              >
                Denegar
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[13px] text-error">
            {error}
          </div>
        )}

        {isFuture ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Btn variant="outline" onClick={handleCancel} disabled={busy}>
              {busy ? d.cancelling : d.cancelButton}
            </Btn>
            <Btn variant="outline" onClick={() => onModify(booking)} disabled={busy}>
              {d.modifyButton}
            </Btn>
            {isAwaitingConfirmation && (
              <Btn onClick={handleConfirm} disabled={busy}>
                {busy ? dict.manager.confirming : dict.manager.confirm}
              </Btn>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
                {d.resultLabel}
              </p>
              <div className="flex gap-1.5">
                <ChoiceBtn active={result === "completed"} onClick={() => setResult("completed")} label={d.resultCompleted} />
                <ChoiceBtn active={result === "no_show"} onClick={() => setResult("no_show")} label={d.resultNoShow} />
                <ChoiceBtn active={result === "cancelled"} onClick={() => setResult("cancelled")} label={d.resultCancelled} />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
                {d.paymentLabel}
              </p>
              <div className="flex gap-1.5">
                <ChoiceBtn active={payment === "paid"} onClick={() => setPayment("paid")} label={d.paymentPaid} />
                <ChoiceBtn active={payment === "unpaid"} onClick={() => setPayment("unpaid")} label={d.paymentPending} />
              </div>
              {payment === "paid" && (
                <div className="mt-2.5">
                  <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
                    {d.paymentMethodLabel}
                  </p>
                  {locked ? (
                    <p className="rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[12.5px] text-ink-soft">
                      {d.paymentMethodLockedNote}
                    </p>
                  ) : (
                    <select
                      value={effectiveMethodChoice}
                      disabled={bonosLoading}
                      onChange={(e) => {
                        setMethodTouched(true);
                        setMethodChoice(e.target.value);
                      }}
                      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink disabled:opacity-60"
                    >
                      {effectiveMethodChoice === "" && <option value="" disabled>{"…"}</option>}
                      <option value="cash">{d.paymentMethodCash}</option>
                      <option value="card">{d.paymentMethodCard}</option>
                      {(activeBonos ?? []).map((b) => (
                        <option key={b.id} value={`bono:${b.id}`}>
                          {d.paymentMethodBonoTemplate
                            .replace("{bonoName}", b.bonoTypeName)
                            .replace("{n}", String(b.sessionsRemaining))}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={onClose} disabled={busy}>
                {d.dismissButton}
              </Btn>
              <Btn onClick={handleSaveResult} disabled={busy || !result || !isDirty || !methodReady}>
                {busy ? d.saving : d.saveButton}
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
