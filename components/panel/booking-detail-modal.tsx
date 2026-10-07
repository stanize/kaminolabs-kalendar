"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import {
  cancelBookingAsOwner,
  confirmBookingAsOwner,
  markBookingReviewedAsOwner,
  updateBookingResult,
  reviewCancellationRequest,
  type BookingPaymentMethod,
} from "@/lib/actions/booking-owner";
import { getActiveBonosForClientAction } from "@/lib/actions/bonos";
import type { ClientActiveBono } from "@/lib/bonos/data";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import { clientStatusLabel, clientStatusBadgeClass, needsClinicFollowUp, type WeekBookingVM } from "@/components/panel/calendar-grid-view";
import { isWhatsappSentinelEmail } from "@/lib/whatsapp/sentinel-email";

const TZ = "Europe/Madrid";

export function BookingDetailModal({
  booking,
  intlLocale,
  dict,
  bonosEnabled,
  onClose,
  onUpdated,
  onModify,
  onCancellationReviewed,
}: {
  booking: WeekBookingVM;
  intlLocale: string;
  dict: CalendarDictionary;
  // clinic-configuration.md's bonos-visibility-toggle — gates the bono
  // option(s) in the Cobrar modal below, forward-looking only (an already
  // bono-paid booking keeps showing its real payment summary regardless).
  bonosEnabled: boolean;
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

  // ── Payment / Resultado (cobrar-button-and-paid-at, 2026-10) ────────────
  // Simplified per Arun: a past appointment only ever ends up in one of
  // three terminal states — paid (Cobrar, which also marks it completed),
  // No-show, or already Cancelada (via the normal cancel flow, unrelated to
  // this section) — no separate Resultado picker, no Guardar step. Each
  // action saves immediately. Once a booking is already paid, the modal
  // only ever shows the static paidSummaryText below — no further payment
  // UI at all here, so the old bono "locked" (switching AWAY from a bono is
  // Bonos-page-only) has nothing left to gate in this component; it's
  // enforced server-side in updateBookingResult regardless.
  const [activeBonos, setActiveBonos] = useState<ClientActiveBono[] | null>(null);
  const [bonosLoading, setBonosLoading] = useState(false);
  // The Cobrar modal (Efectivo/Tarjeta/bono buttons), opened instead of the
  // old inline toggle+selector.
  const [cobrarModalOpen, setCobrarModalOpen] = useState(false);
  // "Editar" next to an already-resolved Pago state (paid or no-show) — lets
  // the clinic correct a mistake by re-showing the Cobrar/No-show buttons
  // instead of the read-only summary. Not offered for an already-cancelled
  // booking (cancelling is a separate, unrelated flow).
  const [editingPayment, setEditingPayment] = useState(false);

  // Fetched lazily — only while the Cobrar modal is open, and only when the
  // clinic has bonos enabled at all (bonos-visibility-flag-interaction,
  // bonos.md) — a disabled flag means no bono option should ever appear
  // going forward, so there's no reason to fetch the list.
  useEffect(() => {
    if (!bonosEnabled || !cobrarModalOpen || !booking.clinicClientId || activeBonos !== null || bonosLoading) return;
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
  }, [bonosEnabled, cobrarModalOpen, booking.clinicClientId, activeBonos, bonosLoading]);

  const isFuture = new Date(booking.startIso) > new Date();
  // Only a GUEST booking can still be pending_confirmation in the normal
  // flow now (2026-09: a patient's own booking, even one made mid-sign-up
  // with an unverified email, is confirmed immediately — see submitBooking,
  // lib/actions/booking.ts. finalizeVerifiedPatientBookings, which used to
  // promote an unverified patient's pending booking on verify, was removed
  // with it — there's nothing left for it to do). A guest_unconfirmed row
  // is now reachable only via admin tooling's statusOverride escape hatch.
  // clientStatus is patient_id-derived (see lib/booking/client-status.ts) —
  // a guest booking is 'guest_unconfirmed'/'guest_confirmed', a
  // patient-linked one is 'first_time'/'returning', so this is a free,
  // zero-schema-change signal.
  const isAwaitingConfirmation = booking.status === "pending_confirmation" && booking.clientStatus === "guest_unconfirmed";
  // The "mark as contacted/reviewed" action — distinct from
  // isAwaitingConfirmation above: this booking is ALREADY confirmed (guest-
  // immediate-confirm-with-clinic-followup), clinic_reviewed_at is purely a
  // standing follow-up flag, not a confirmation gate. Available regardless
  // of past/future (isFuture), since the Clientes tab now surfaces guest
  // history too — a clinic should be able to mark a past no-show contact
  // just as easily as an upcoming one. Also applies to first_time patient
  // bookings (2026-09) — a first-time patient is confirmed immediately
  // too, but is still someone the clinic hasn't met, same as a guest.
  const needsReview = needsClinicFollowUp(booking.clientStatus, booking.clinicReviewedAt) && booking.clientStatus !== "guest_unconfirmed";
  const hasRealEmail =
    booking.clientEmail &&
    !booking.clientEmail.startsWith("sin-email+") &&
    !isWhatsappSentinelEmail(booking.clientEmail);

  const dateTimeLabel = new Intl.DateTimeFormat(intlLocale, {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date(booking.startIso));

  // cobrar-button-and-paid-at: "Pagado con {método} · {hora}" — only shown
  // for a booking that's ALREADY saved as paid (booking.paymentStatus, not
  // the mid-edit `payment`/effectiveMethodChoice state), using the real
  // persisted payment_method + paid_at rather than whatever's being edited.
  const paidSummaryText =
    booking.paymentStatus === "paid" && booking.paidAt
      ? d.paidWithTemplate
          .replace(
            "{method}",
            booking.paymentMethod === "cash"
              ? d.paymentMethodCash
              : booking.paymentMethod === "card"
                ? d.paymentMethodCard
                : d.paymentMethodBono
          )
          .replace(
            "{time}",
            new Intl.DateTimeFormat(intlLocale, { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(
              new Date(booking.paidAt)
            )
          )
      : null;

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

  const handleMarkReviewed = async () => {
    setBusy(true);
    setError(null);
    const res = await markBookingReviewedAsOwner(booking.id, dict.errors);
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

  // cobrar-button-and-paid-at: charges immediately on selection (no separate
  // Guardar step). DECIDED (2026-10): paying also marks the appointment
  // completed in the same write — a past appointment that's been paid is,
  // by definition, one that happened, so there's no separate Resultado
  // choice to make.
  const handleCobrar = async (methodValue: string) => {
    setBusy(true);
    setError(null);
    const paymentMethod: BookingPaymentMethod = methodValue.startsWith("bono:")
      ? { bonoPurchaseId: methodValue.slice("bono:".length) }
      : (methodValue as "cash" | "card");
    const res = await updateBookingResult(
      { bookingId: booking.id, status: "completed", paymentStatus: "paid", paymentMethod },
      dict.errors
    );
    setBusy(false);
    setCobrarModalOpen(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    onClose();
  };

  // No-show: the other terminal state for a past appointment, saved
  // immediately — no Resultado picker, no separate Guardar step. Leaves
  // payment untouched (re-sends the booking's current unchanged value,
  // same as the rest of this file's pattern) since a no-show is, by
  // definition, not being charged here.
  const handleNoShow = async () => {
    setBusy(true);
    setError(null);
    // BUG FOUND + FIXED (2026-10-07, Arun, live testing): this used to
    // re-send the booking's PREVIOUS payment state unchanged, so marking
    // No-show via Editar on an already-paid booking left the stale
    // "Pagado con ..." summary in place even though the grid chip
    // correctly showed No-show. No-show and paid are the two mutually
    // exclusive terminal states (per Arun's original framing), so this
    // always clears payment to unpaid — matches updateBookingResult's
    // already-existing unpaid-flip behavior, which also correctly
    // restores a deducted bono session via the sync_bono_session_usage
    // trigger when the booking was previously bono-paid.
    const res = await updateBookingResult(
      { bookingId: booking.id, status: "no_show", paymentStatus: "unpaid" },
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
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${clientStatusBadgeClass(booking.clientStatus, booking.clinicReviewedAt)}`}>
              {clientStatusLabel(booking.clientStatus, booking.clinicReviewedAt)}
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

        {needsReview && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-sky-800">
              <Icon name="bell" size={14} className="shrink-0" />
              {booking.clientStatus === "first_time"
                ? "Primera vez — sin seguimiento aún por la clínica"
                : "Invitado sin seguimiento — aún no contactado por la clínica"}
            </p>
            <button
              type="button"
              onClick={handleMarkReviewed}
              disabled={busy}
              className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:brightness-95 disabled:opacity-60"
            >
              {busy ? dict.manager.markingReviewed : dict.manager.markReviewed}
            </button>
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
                {d.paymentLabel}
              </p>
              {booking.status === "cancelled" ? (
                <p className="rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[12.5px] font-medium text-ink">
                  {d.resultCancelled}
                </p>
              ) : !editingPayment && paidSummaryText ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                  <p className="text-[12.5px] font-medium text-ink">{paidSummaryText}</p>
                  <button
                    type="button"
                    onClick={() => setEditingPayment(true)}
                    className="shrink-0 text-[12.5px] font-semibold text-brand hover:underline"
                  >
                    {d.editPaymentButton}
                  </button>
                </div>
              ) : !editingPayment && booking.status === "no_show" ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                  <p className="text-[12.5px] font-medium text-ink">{d.resultNoShow}</p>
                  <button
                    type="button"
                    onClick={() => setEditingPayment(true)}
                    className="shrink-0 text-[12.5px] font-semibold text-brand hover:underline"
                  >
                    {d.editPaymentButton}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Btn variant="primary" onClick={() => setCobrarModalOpen(true)} disabled={busy}>
                    {d.cobrarButton}
                  </Btn>
                  <Btn variant="outline" size="sm" onClick={handleNoShow} disabled={busy}>
                    {d.resultNoShow}
                  </Btn>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Btn variant="ghost" onClick={onClose} disabled={busy}>
                {d.dismissButton}
              </Btn>
            </div>
          </div>
        )}
      </div>

      {cobrarModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          onClick={() => !busy && setCobrarModalOpen(false)}
        >
          <div
            className="w-full max-w-[340px] rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-[15px] font-bold text-ink">{d.cobrarModalTitle}</h3>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleCobrar("cash")}
                disabled={busy}
                className="rounded-xl border border-line bg-surface px-4 py-4 text-[15px] font-semibold text-ink transition-colors hover:border-brand-line hover:bg-brand-weak disabled:opacity-60"
              >
                {d.paymentMethodCash}
              </button>
              <button
                type="button"
                onClick={() => handleCobrar("card")}
                disabled={busy}
                className="rounded-xl border border-line bg-surface px-4 py-4 text-[15px] font-semibold text-ink transition-colors hover:border-brand-line hover:bg-brand-weak disabled:opacity-60"
              >
                {d.paymentMethodCard}
              </button>
              {/* bonos-visibility-flag-interaction (bonos.md): only ever
                  offered when the clinic has bonos enabled AND the client
                  has at least one active bono. */}
              {bonosEnabled &&
                (activeBonos ?? []).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleCobrar(`bono:${b.id}`)}
                    disabled={busy}
                    className="rounded-xl border border-line bg-surface px-4 py-4 text-[15px] font-semibold text-ink transition-colors hover:border-brand-line hover:bg-brand-weak disabled:opacity-60"
                  >
                    {d.paymentMethodBonoTemplate
                      .replace("{bonoName}", b.bonoTypeName)
                      .replace("{n}", String(b.sessionsRemaining))}
                  </button>
                ))}
              {bonosEnabled && bonosLoading && (
                <p className="text-center text-[12.5px] text-ink-soft">…</p>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Btn variant="ghost" onClick={() => setCobrarModalOpen(false)} disabled={busy}>
                {d.cobrarCancel}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
