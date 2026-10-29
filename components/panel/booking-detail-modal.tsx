"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import {
  cancelBookingAsOwner,
  confirmBookingAsOwner,
  markBookingReviewedAsOwner,
  updateBookingAsOwner,
  updateBookingResult,
  reviewCancellationRequest,
  type BookingPaymentMethod,
} from "@/lib/actions/booking-owner";
import { getActiveBonosForClientAction } from "@/lib/actions/bonos";
import type { ClientActiveBono } from "@/lib/bonos/data";
import { checkExistingInvoiceForBooking, resendInvoice } from "@/lib/actions/invoices";
import type { InvoiceRow } from "@/lib/invoices/data";
import { zonedTimeToUtc, dayIdInTz, tzDateParts } from "@/lib/calendar/client-date";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { InvoicingDictionary } from "@/lib/i18n/dictionaries/invoicing";
import type { DayId } from "@/lib/onboarding/types";
import { clientStatusLabel, clientStatusBadgeClass, needsClinicFollowUp, type WeekBookingVM } from "@/components/panel/calendar-grid-view";
import { InvoiceConfirmModal, hasRealEmail } from "@/components/panel/invoice-confirm-modal";
import type { ClosureRuleVM } from "@/components/panel/appointment-modal";
import { PAYMENT_METHOD_CODES, type PaymentMethodCode } from "@/lib/booking/payment-methods";
import { isWhatsappSentinelEmail } from "@/lib/whatsapp/sentinel-email";
import {
  type ServiceVM,
  type MemberVM,
  type TimeRangeVM,
  toMinutes,
  ymd,
  hhmmFromIso,
  buildSuggestedTimes,
} from "@/lib/booking/appointment-fields";

function invoicePdfHref(invoice: { id: string; access_token: string }): string {
  return `/api/invoices/${invoice.id}/pdf?token=${invoice.access_token}`;
}

// payment-cancellation-flow-expansion: shared by the paid-summary line and
// the Cobrar modal's button labels, so the two never drift apart.
function paymentMethodLabel(
  method: PaymentMethodCode | "bono",
  d: CalendarDictionary["detailModal"]
): string {
  switch (method) {
    case "cash": return d.paymentMethodCash;
    case "card": return d.paymentMethodCard;
    case "bank_transfer": return d.paymentMethodBankTransfer;
    case "bizum": return d.paymentMethodBizum;
    case "direct_debit": return d.paymentMethodDirectDebit;
    case "paypal": return d.paymentMethodPaypal;
    case "other": return d.paymentMethodOther;
    case "bono": return d.paymentMethodBono;
  }
}

const TZ = "Europe/Madrid";

export function BookingDetailModal({
  booking,
  intlLocale,
  dict,
  invoicingDict,
  bonosEnabled,
  autoInvoiceEnabled,
  hoursByDay,
  allBookings,
  services,
  members,
  closures,
  whatsappEnabled,
  onClose,
  onUpdated,
  onCancellationReviewed,
}: {
  booking: WeekBookingVM;
  intlLocale: string;
  dict: CalendarDictionary;
  // invoice-on-payment-trigger (pdf-invoicing.md) — the post-Cobrar
  // Sí/No invoice confirm modal's copy.
  invoicingDict: InvoicingDictionary;
  // clinic-configuration.md's bonos-visibility-toggle — gates the bono
  // option(s) in the Cobrar modal below, forward-looking only (an already
  // bono-paid booking keeps showing its real payment summary regardless).
  bonosEnabled: boolean;
  // auto-invoice-setting — when true, Cobrar generates+sends the invoice
  // immediately with no confirm modal at all.
  autoInvoiceEnabled: boolean;
  // detail-panel-inline-edit (2026-10): this panel now edits the
  // appointment's own fields directly (service/provider/date/time/client)
  // instead of handing off to a separate AppointmentModal edit step — same
  // data AppointmentModal needs for its conflict/closure checks.
  hoursByDay: Partial<Record<DayId, TimeRangeVM[]>>;
  allBookings: WeekBookingVM[];
  services: ServiceVM[];
  members: MemberVM[];
  closures: ClosureRuleVM[];
  whatsappEnabled: boolean;
  onClose: () => void;
  onUpdated: () => void;
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
  // invoice-generation-now-manual-only (2026-10): auto-invoice is on hold
  // per Arun — kept as an accepted prop (the setting itself still exists
  // in Ajustes) but deliberately not read anywhere below for now.
  void autoInvoiceEnabled;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // side-panel-pattern (rollout, 2026-10) — same shell/transition as
  // AppointmentModal: slides in from the right over the main content,
  // leaving the sidebar visible on desktop. See that component for the
  // full rationale on the enter/exit timing.
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
  // BUG FOUND + FIXED (2026-10-29, Arun, live testing): this used to be
  // named `close` — which collides with the browser's global
  // `window.close()` (declared in lib.dom, so it compiles/lints clean).
  // guardedClose()'s `close()` call and the discard dialog's button were
  // silently resolving to that global no-op instead of this function, so
  // the X button and backdrop click did nothing unless the booking was
  // actually dirty-and-saved (the one path that went through
  // requestClose(onClose) directly, in handleSaveFields, never through
  // this helper). Renamed to avoid shadowing a global ever again.
  const closePanel = () => requestClose(onClose);
  // detail-panel-inline-edit (2026-10): the appointment's own fields,
  // editable directly in this panel instead of a separate "Modificar" step
  // — same field set/validation AppointmentModal's edit mode used to own.
  // `md` is dict.modal, reused as-is (same labels/placeholders) rather than
  // duplicated under detailModal.
  const md = dict.modal;
  const initialDateParts = tzDateParts(new Date(booking.startIso));
  const initialFields = {
    serviceId: booking.serviceId ?? services[0]?.id ?? "",
    teamMemberId: booking.teamMemberId ?? members[0]?.id ?? "",
    dateStr: ymd(initialDateParts.year, initialDateParts.month, initialDateParts.day),
    timeStr: hhmmFromIso(booking.startIso),
    clientName: booking.clientName,
    clientEmail:
      booking.clientEmail && !booking.clientEmail.startsWith("sin-email+") && !isWhatsappSentinelEmail(booking.clientEmail)
        ? booking.clientEmail
        : "",
    clientPhone: booking.clientPhone ?? "",
    notes: booking.notes ?? "",
  };

  const [serviceId, setServiceId] = useState(initialFields.serviceId);
  const [teamMemberId, setTeamMemberId] = useState(initialFields.teamMemberId);
  const [dateStr, setDateStr] = useState(initialFields.dateStr);
  const [timeStr, setTimeStr] = useState(initialFields.timeStr);
  const [clientName, setClientName] = useState(initialFields.clientName);
  const [clientEmail, setClientEmail] = useState(initialFields.clientEmail);
  const [clientPhone, setClientPhone] = useState(initialFields.clientPhone);
  const [fieldsNotes, setFieldsNotes] = useState(initialFields.notes);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [timeMenuOpen, setTimeMenuOpen] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const isDirty =
    serviceId !== initialFields.serviceId ||
    teamMemberId !== initialFields.teamMemberId ||
    dateStr !== initialFields.dateStr ||
    timeStr !== initialFields.timeStr ||
    clientName !== initialFields.clientName ||
    clientEmail !== initialFields.clientEmail ||
    clientPhone !== initialFields.clientPhone ||
    fieldsNotes !== initialFields.notes;

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const timeValid = /^\d{2}:\d{2}$/.test(timeStr);

  const selectedDateParts = useMemo(() => {
    if (!dateValid) return null;
    const [y, m, dd] = dateStr.split("-").map(Number);
    return { year: y, month: m, day: dd };
  }, [dateValid, dateStr]);

  const selectedDayRanges = useMemo(() => {
    if (!selectedDateParts) return [];
    const dayId = dayIdInTz(zonedTimeToUtc(selectedDateParts.year, selectedDateParts.month, selectedDateParts.day, 12, 0));
    return hoursByDay[dayId] ?? [];
  }, [selectedDateParts, hoursByDay]);

  const selectedDayBookings = useMemo(() => {
    if (!selectedDateParts) return [];
    return allBookings.filter((b) => {
      if (b.id === booking.id) return false; // exclude itself from conflict checks
      const p = tzDateParts(new Date(b.startIso));
      return p.year === selectedDateParts.year && p.month === selectedDateParts.month && p.day === selectedDateParts.day;
    });
  }, [selectedDateParts, allBookings, booking.id]);

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

  const fieldsConflict = timeValid ? isTimeTaken(timeStr) : false;

  const closureWarningLabel = useMemo(() => {
    if (!selectedDateParts) return null;
    const dStr = ymd(selectedDateParts.year, selectedDateParts.month, selectedDateParts.day);
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
      if (dStr < c.startDate || dStr > c.endDate) continue;
      if (c.startTime && c.endTime && apptStart !== null && apptEnd !== null) {
        const cStart = toMinutes(c.startTime);
        const cEnd = toMinutes(c.endTime);
        if (apptStart >= cEnd || apptEnd <= cStart) continue; // no overlap
      }
      return c.label || md.closureGenericLabel;
    }
    return null;
  }, [selectedDateParts, timeStr, timeValid, durationMin, teamMemberId, closures, md.closureGenericLabel]);

  const handleSaveFields = async () => {
    if (!serviceId || !teamMemberId || !startDate || fieldsConflict) return;
    setSavingFields(true);
    setError(null);
    const res = await updateBookingAsOwner(
      {
        bookingId: booking.id,
        serviceId,
        teamMemberId,
        startIso: startDate.toISOString(),
        clientName,
        clientEmail: clientEmail || undefined,
        clientPhone: clientPhone || undefined,
        notes: fieldsNotes || undefined,
        sendConfirmationEmail: sendEmail,
        sendConfirmationWhatsapp: whatsappEnabled && sendWhatsapp,
      },
      dict.manualErrors
    );
    setSavingFields(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    requestClose(onClose);
  };

  // detail-panel-inline-edit: closing with unsaved field changes asks for
  // confirmation first instead of silently discarding them — every other
  // close path (actions below that already committed something server-
  // side) goes straight through requestClose, unaffected.
  function guardedClose() {
    if (isDirty) { setDiscardConfirmOpen(true); return; }
    closePanel();
  }

  // payment-cancellation-flow-expansion: "Cancelar cita" for a PAST,
  // UNRESOLVED booking (still pending_confirmation/confirmed — nothing
  // was ever Cobrado/No-show'd for it, just its time has passed) — a
  // retroactive cancel, distinct from the existing No-show button
  // (which is its own status, not a cancellation reason). Scoped
  // deliberately to the unresolved case only; an already-paid or
  // already-no_show booking has no cancel entry point here (open
  // question flagged in workflows/calendar-management-past.md — what a
  // reversal should actually do to a deducted bono session or an
  // already-generated invoice was never addressed, so it's not built).
  const [pastCancelOpen, setPastCancelOpen] = useState(false);
  const [pastCancelReason, setPastCancelReason] = useState<"schedule_error" | "other">("schedule_error");
  const [pastCancelOtherText, setPastCancelOtherText] = useState("");

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
  // invoice-generation-now-manual-only (2026-10): Cobrar no longer closes
  // this panel, so its result has to be reflected locally — `booking` is
  // a stale prop snapshot from the moment the panel opened, only
  // refreshed when the parent list itself refetches. Preferred over
  // `booking.paymentStatus`/`paymentMethod`/`paidAt` everywhere below via
  // the `effective*` values.
  const [paidOverride, setPaidOverride] = useState<{ paymentMethod: PaymentMethodCode | "bono"; paidAt: string } | null>(null);
  const effectivePaymentStatus = paidOverride ? "paid" : booking.paymentStatus;
  const effectivePaymentMethod = paidOverride?.paymentMethod ?? booking.paymentMethod;
  const effectivePaidAt = paidOverride?.paidAt ?? booking.paidAt;

  // ── Invoice confirm (invoice-on-payment-trigger, pdf-invoicing.md) ──────
  // invoice-generation-now-manual-only (2026-10): no longer auto-opened
  // right after Cobrar — the clinic opens it explicitly via the "Generar
  // factura" button in the Factura section below, once the booking is
  // paid and has no invoice yet. Auto-invoice (autoInvoiceEnabled) is on
  // hold for now, not read anywhere in this component.
  const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false);
  const invoiceDict = invoicingDict.confirmModal;

  // view-invoice-from-booking-modal (2026-10): lets the clinic see/download
  // the invoice right from this modal once one exists for the booking,
  // instead of having to go find it on the Facturas page or the client's
  // own page. Fetched once per booking — refreshed below whenever a new
  // invoice gets created from within this modal.
  const [existingInvoice, setExistingInvoice] = useState<InvoiceRow | null>(null);
  // invoice-section-loading-skeleton (2026-10): the lookup is only ever
  // relevant once the booking is paid (invoices don't exist otherwise), so
  // the fetch is skipped entirely outside that case below — avoids both a
  // wasted request and a Factura section that could pop in after the rest
  // of the modal has already settled. While paid and still loading, a
  // same-shaped skeleton (gated on the `effectivePaymentStatus === "paid"
  // && invoiceLoading` check at the render site) holds the section's
  // place so nothing shifts once the real buttons/Generar factura arrive.
  // Re-runs off `effectivePaymentStatus` (not the stale `booking.
  // paymentStatus`) so a Cobrar done from within this open panel also
  // triggers the lookup.
  const [invoiceLoading, setInvoiceLoading] = useState(booking.paymentStatus === "paid");
  useEffect(() => {
    if (effectivePaymentStatus !== "paid") return;
    let cancelled = false;
    checkExistingInvoiceForBooking(booking.id).then((inv) => {
      if (cancelled) return;
      setExistingInvoice(inv);
      setInvoiceLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [booking.id, effectivePaymentStatus]);

  const [resendingInvoice, setResendingInvoice] = useState(false);
  const [resendInvoiceError, setResendInvoiceError] = useState<string | null>(null);
  // reenviar-missing-email-prompt (2026-10): the invoice's own client_email
  // might be absent/synthetic (no-email-on-file or a WhatsApp sentinel
  // address) — same "has a real email" rule the confirm modal uses.
  // Reenviar then asks for one inline instead of silently failing, and
  // saves it to the invoice + the linked client's profile, same as the
  // confirm modal's missing-email case.
  const [resendEmailPromptOpen, setResendEmailPromptOpen] = useState(false);
  const [resendEmailInput, setResendEmailInput] = useState("");

  function handleResendInvoice() {
    if (!existingInvoice) return;
    if (!hasRealEmail(existingInvoice.client_email)) {
      setResendEmailPromptOpen(true);
      setResendInvoiceError(null);
      return;
    }
    doResendInvoice();
  }

  async function doResendInvoice(alternateEmail?: string) {
    if (!existingInvoice) return;
    setResendingInvoice(true);
    setResendInvoiceError(null);
    const res = await resendInvoice({
      invoiceId: existingInvoice.id,
      alternateEmail,
      saveToProfile: !!alternateEmail,
    });
    setResendingInvoice(false);
    if (!res.ok) {
      setResendInvoiceError(res.error);
      return;
    }
    setResendEmailPromptOpen(false);
    setResendEmailInput("");
  }

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
  // cobrar-button-and-paid-at: "Pagado con {método} · {hora}" — uses the
  // effective* values (the real persisted state, or this panel's own
  // paidOverride right after a Cobrar done without closing).
  const paidSummaryText =
    effectivePaymentStatus === "paid" && effectivePaidAt
      ? d.paidWithTemplate
          .replace("{method}", effectivePaymentMethod ? paymentMethodLabel(effectivePaymentMethod, d) : "")
          .replace(
            "{time}",
            new Intl.DateTimeFormat(intlLocale, { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(
              new Date(effectivePaidAt)
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
    requestClose(onClose);
  };

  const handlePastCancel = async () => {
    const reasonText = pastCancelReason === "other" ? pastCancelOtherText.trim() : d.pastCancelReasonScheduleError;
    setBusy(true);
    setError(null);
    const res = await cancelBookingAsOwner(booking.id, dict.errors, reasonText);
    setBusy(false);
    setPastCancelOpen(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    requestClose(onClose);
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    const res = await confirmBookingAsOwner(booking.id, dict.errors);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    requestClose(onClose);
  };

  const handleMarkReviewed = async () => {
    setBusy(true);
    setError(null);
    const res = await markBookingReviewedAsOwner(booking.id, dict.errors);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    requestClose(onClose);
  };

  const handleReviewRequest = async (decision: "approve" | "deny") => {
    setBusy(true);
    setError(null);
    const res = await reviewCancellationRequest(booking.id, decision, dict.errors);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onUpdated();
    onCancellationReviewed?.();
    requestClose(onClose);
  };

  // cobrar-button-and-paid-at: charges immediately on selection (no separate
  // Guardar step). DECIDED (2026-10): paying a PAST appointment also marks
  // it completed in the same write — by definition, one that happened, so
  // there's no separate Resultado choice to make.
  // payment-cancellation-flow-expansion: Cobrar is now also reachable on a
  // FUTURE appointment (prepayment) — that write omits `status` entirely
  // (updateBookingResult's existing optional-status behavior), since the
  // appointment hasn't happened yet and shouldn't be silently marked
  // completed just because it was paid for in advance.
  const handleCobrar = async (methodValue: string) => {
    setBusy(true);
    setError(null);
    const paymentMethod: BookingPaymentMethod = methodValue.startsWith("bono:")
      ? { bonoPurchaseId: methodValue.slice("bono:".length) }
      : (methodValue as PaymentMethodCode);
    const res = await updateBookingResult(
      { bookingId: booking.id, ...(isFuture ? {} : { status: "completed" as const }), paymentStatus: "paid", paymentMethod },
      dict.errors
    );
    setBusy(false);
    setCobrarModalOpen(false);
    if (!res.ok) { setError(res.error); return; }

    // invoice-generation-now-manual-only (2026-10, Arun): Cobrar used to
    // auto-check for an existing invoice and either skip, auto-generate
    // (autoInvoiceEnabled), or auto-open the confirm modal — then close
    // this panel either way. Per Arun, invoice generation is on hold as a
    // manual-only, clinic-initiated step for now: Cobrar just records the
    // payment, stays on this panel (paidOverride below reflects it
    // immediately), and the Factura section's new "Generar factura"
    // button is what starts that flow, whenever the clinic chooses to.
    setPaidOverride({
      paymentMethod: methodValue.startsWith("bono:") ? "bono" : (methodValue as PaymentMethodCode),
      paidAt: new Date().toISOString(),
    });
    setEditingPayment(false);
    // Was unpaid (or no_show) a moment ago, so no invoice lookup has run
    // yet for this booking — show the Factura skeleton until the effect
    // above resolves it, instead of a one-tick gap with nothing there.
    setInvoiceLoading(true);
    onUpdated();
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
    requestClose(onClose);
  };

  // Shared by the future- and past-appointment branches below — a paid
  // booking (prepaid or paid-on-the-day) can generate a factura either
  // way. invoice-generation-now-manual-only: the "Generar factura" button
  // is the only thing that opens invoiceConfirmOpen now.
  const invoiceSection =
    effectivePaymentStatus === "paid" &&
    (invoiceLoading ? (
      <div>
        <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
          {d.invoiceLabel}
        </p>
        <div className="flex items-center gap-2">
          <div className="h-8 w-[110px] animate-pulse rounded-lg bg-surface-2" />
          <div className="h-8 w-[90px] animate-pulse rounded-lg bg-surface-2" />
        </div>
      </div>
    ) : existingInvoice ? (
      <div>
        <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
          {d.invoiceLabel}
        </p>
        <div className="flex items-center gap-2">
          <a href={invoicePdfHref(existingInvoice)} target="_blank" rel="noopener noreferrer">
            <Btn variant="outline" size="sm">
              <Icon name="externalLink" size={13} />
              {invoicingDict.page.download}
            </Btn>
          </a>
          <Btn variant="outline" size="sm" onClick={handleResendInvoice} disabled={resendingInvoice}>
            {resendingInvoice ? invoicingDict.page.resending : invoicingDict.page.resend}
          </Btn>
        </div>
        {resendEmailPromptOpen && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="email"
              value={resendEmailInput}
              onChange={(e) => setResendEmailInput(e.target.value)}
              placeholder={invoicingDict.confirmModal.missingEmailPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink"
            />
            <Btn
              variant="outline"
              size="sm"
              onClick={() => doResendInvoice(resendEmailInput.trim())}
              disabled={resendingInvoice || !resendEmailInput.trim()}
            >
              {resendingInvoice ? invoicingDict.page.resending : invoicingDict.page.resend}
            </Btn>
          </div>
        )}
        {resendInvoiceError && <p className="mt-1.5 text-[12px] text-error">{resendInvoiceError}</p>}
      </div>
    ) : (
      <div>
        <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
          {d.invoiceLabel}
        </p>
        <Btn variant="primary" onClick={() => setInvoiceConfirmOpen(true)}>
          {d.generateInvoiceButton}
        </Btn>
      </div>
    ));

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 md:left-[240px]">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={guardedClose}
        aria-hidden
      />
      <div
        className={`absolute inset-y-0 right-0 flex h-full w-full flex-col overflow-y-auto bg-surface p-5 shadow-2xl transition-transform duration-200 ease-out sm:w-1/2 sm:min-w-[480px] sm:p-8 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[17px] font-bold text-ink">{booking.serviceName}</h2>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${clientStatusBadgeClass(booking.clientStatus, booking.clinicReviewedAt)}`}>
              {clientStatusLabel(booking.clientStatus, booking.clinicReviewedAt)}
            </span>
          </div>
          <button
            onClick={guardedClose}
            aria-label={d.close}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {isAwaitingConfirmation && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-orange-700">
            <Icon name="bell" size={14} className="shrink-0" />
            <span className="text-[13px] font-semibold">Pendiente de confirmación</span>
          </div>
        )}
        {booking.reminderSendFailed && (
          <div
            className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700"
            title={booking.lastReminderError ?? undefined}
          >
            <Icon name="bell" size={14} className="shrink-0" />
            <span className="text-[13px] font-semibold">
              Recordatorio no enviado{booking.lastReminderError ? `: ${booking.lastReminderError}` : ""}
            </span>
          </div>
        )}

        {/* detail-panel-inline-edit: the appointment's own fields, editable
            directly — replaces the old read-only summary + separate
            "Modificar" step. Guardar cambios only lights up once something
            actually changed from the booking's current saved state. */}
        <div className="mb-4 flex flex-col gap-3">
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
                    fieldsConflict ? "border-error" : "border-line"
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
          {isOutsideHours && !fieldsConflict && (
            <span className="-mt-2 text-[12px] text-ink-soft">{md.outsideHoursNote}</span>
          )}
          {closureWarningLabel && !fieldsConflict && (
            <span className="-mt-2 text-[12px] text-amber-600">
              {md.closureWarningNote.replace("{label}", closureWarningLabel)}
            </span>
          )}
          {fieldsConflict && (
            <div className="rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">
              {dict.manualErrors.errSlotTaken}
            </div>
          )}

          <Field label={md.clientNameLabel}>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={md.clientNamePlaceholder}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[16px] text-ink"
            />
          </Field>
          {/* client-link-from-appointment (2026-10): a booking linked to a
              clinic client still jumps to that client's profile — now a
              small link under the name field since the name itself is an
              editable input. Guest/unlinked bookings show nothing here. */}
          {booking.clinicClientId && (
            <Link
              href={`/panel/clients/${booking.clinicClientId}`}
              className="-mt-2 self-start text-[12.5px] font-semibold text-brand hover:underline"
            >
              Ver perfil del cliente
            </Link>
          )}

          <Field label={md.clientEmailLabel}>
            <input
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder={md.clientEmailPlaceholder}
              type="email"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[16px] text-ink"
            />
          </Field>

          <Field label={md.clientPhoneLabel}>
            <input
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder={md.clientPhonePlaceholder}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[16px] text-ink"
            />
          </Field>

          <Field label={md.notesLabel}>
            <textarea
              value={fieldsNotes}
              onChange={(e) => setFieldsNotes(e.target.value)}
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

          <div className="flex justify-end">
            <Btn
              variant={isDirty ? "primary" : "outline"}
              onClick={handleSaveFields}
              disabled={
                !isDirty || savingFields || !clientName.trim() || !serviceId || !teamMemberId || !dateValid || !timeValid || fieldsConflict
              }
            >
              {savingFields ? md.saving : md.saveButton}
            </Btn>
          </div>
        </div>

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
          <div className="flex flex-col gap-4">
            {/* payment-cancellation-flow-expansion: Cobrar is now reachable
                on a future appointment too (prepayment) — not just past.
                Paying doesn't mark it completed (handleCobrar omits
                `status` when isFuture); it only sets the payment fields. */}
            {!editingPayment && paidSummaryText ? (
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
            ) : (
              <Btn variant="outline" size="sm" onClick={() => setCobrarModalOpen(true)} disabled={busy}>
                {d.cobrarButton}
              </Btn>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Btn variant="outline" onClick={handleCancel} disabled={busy}>
                {busy ? d.cancelling : d.cancelButton}
              </Btn>
              {isAwaitingConfirmation && (
                <Btn onClick={handleConfirm} disabled={busy}>
                  {busy ? dict.manager.confirming : dict.manager.confirm}
                </Btn>
              )}
            </div>

            {invoiceSection}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
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
              <div className="flex flex-wrap items-center gap-2">
                <Btn variant="primary" onClick={() => setCobrarModalOpen(true)} disabled={busy}>
                  {d.cobrarButton}
                </Btn>
                <Btn variant="outline" size="sm" onClick={handleNoShow} disabled={busy}>
                  {d.resultNoShow}
                </Btn>
                {/* payment-cancellation-flow-expansion: a retroactive
                    cancel for an unresolved past booking — distinct from
                    No-show above, which is its own status/button. */}
                <Btn variant="outline" size="sm" onClick={() => setPastCancelOpen(true)} disabled={busy}>
                  {d.pastCancelButton}
                </Btn>
              </div>
            )}

            {invoiceSection}
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
            {/* payment-cancellation-flow-expansion: expanded from
                Efectivo/Tarjeta to the full PAYMENT_METHOD_CODES list — a
                2-column grid, same button style as before. */}
            <div className="grid grid-cols-2 gap-2.5">
              {PAYMENT_METHOD_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleCobrar(code)}
                  disabled={busy}
                  className="rounded-xl border border-line bg-surface px-3 py-4 text-[14px] font-semibold text-ink transition-colors hover:border-brand-line hover:bg-brand-weak disabled:opacity-60"
                >
                  {paymentMethodLabel(code, d)}
                </button>
              ))}
            </div>
            {/* bonos-visibility-flag-interaction (bonos.md): only ever
                offered when the clinic has bonos enabled AND the client
                has at least one active bono. Full-width, below the method
                grid — a bono option names a specific purchase, doesn't fit
                the fixed-label grid cells above. */}
            {(bonosEnabled && ((activeBonos ?? []).length > 0 || bonosLoading)) && (
              <div className="mt-2.5 flex flex-col gap-2.5">
                {(activeBonos ?? []).map((b) => (
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
                {bonosLoading && <p className="text-center text-[12.5px] text-ink-soft">…</p>}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Btn variant="ghost" onClick={() => setCobrarModalOpen(false)} disabled={busy}>
                {d.cobrarCancel}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {pastCancelOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          onClick={() => !busy && setPastCancelOpen(false)}
        >
          <div
            className="w-full max-w-[360px] rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-[15px] font-bold text-ink">{d.pastCancelModalTitle}</h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[13.5px] text-ink">
                <input
                  type="radio"
                  checked={pastCancelReason === "schedule_error"}
                  onChange={() => setPastCancelReason("schedule_error")}
                  className="h-4 w-4"
                />
                {d.pastCancelReasonScheduleError}
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[13.5px] text-ink">
                <input
                  type="radio"
                  checked={pastCancelReason === "other"}
                  onChange={() => setPastCancelReason("other")}
                  className="h-4 w-4"
                />
                {d.pastCancelReasonOther}
              </label>
              {pastCancelReason === "other" && (
                <input
                  value={pastCancelOtherText}
                  onChange={(e) => setPastCancelOtherText(e.target.value)}
                  placeholder={d.pastCancelOtherPlaceholder}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink"
                />
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setPastCancelOpen(false)} disabled={busy}>
                {d.pastCancelBack}
              </Btn>
              <Btn
                onClick={handlePastCancel}
                disabled={busy || (pastCancelReason === "other" && !pastCancelOtherText.trim())}
              >
                {busy ? d.cancelling : d.pastCancelConfirm}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {invoiceConfirmOpen && (
        <InvoiceConfirmModal
          bookingId={booking.id}
          clinicClientId={booking.clinicClientId}
          clientEmail={booking.clientEmail}
          serviceName={booking.serviceName}
          dict={invoiceDict}
          onClose={() => setInvoiceConfirmOpen(false)}
          onDone={async () => {
            setInvoiceConfirmOpen(false);
            setInvoiceLoading(true);
            const inv = await checkExistingInvoiceForBooking(booking.id);
            setExistingInvoice(inv);
            setInvoiceLoading(false);
            onUpdated();
          }}
        />
      )}

      {discardConfirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setDiscardConfirmOpen(false)}
        >
          <div
            className="w-full max-w-[360px] rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-[15px] font-bold text-ink">{d.discardTitle}</h3>
            <p className="mb-4 text-[13px] text-ink-soft">{d.discardBody}</p>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setDiscardConfirmOpen(false)}>
                {d.discardStay}
              </Btn>
              <Btn
                variant="outline"
                onClick={() => {
                  setDiscardConfirmOpen(false);
                  closePanel();
                }}
              >
                {d.discardConfirm}
              </Btn>
            </div>
          </div>
        </div>
      )}
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
