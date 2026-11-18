"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { createAndSendInvoice, getInvoiceBookingDefaults, listInvoiceConcepts } from "@/lib/actions/invoices";
import { getClientIdentity } from "@/lib/actions/clients";
import type { InvoicingDictionary } from "@/lib/i18n/dictionaries/invoicing";
import { isWhatsappSentinelEmail } from "@/lib/whatsapp/sentinel-email";

let conceptsDatalistSeq = 0;

/** A synthetic "sin-email+..."/WhatsApp-sentinel address doesn't count as a
 * real, sendable email — shared by every invoice entry point (Cobrar,
 * Facturas > Pendientes, the client page) so they all agree on what "has
 * an email on file" means. */
export function hasRealEmail(email: string | null | undefined): boolean {
  return !!email && !email.startsWith("sin-email+") && !isWhatsappSentinelEmail(email);
}

// auto-open-invoice-pdf (2026-11-02, per Arun): same URL shape as the
// "Descargar" link shown elsewhere (booking-detail-modal.tsx's
// invoicePdfHref) — duplicated here rather than shared, same one-liner.
function invoicePdfHref(invoice: { id: string; access_token: string }): string {
  return `/api/invoices/${invoice.id}/pdf?token=${invoice.access_token}`;
}

/** "60,00" / "60.00" / "60" -> 60; anything else (blank, text, negative) -> NaN. */
function parseAmount(raw: string): number {
  const s = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}

function formatAmount(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

// How long to wait after the last keystroke before refreshing the preview.
const PREVIEW_DEBOUNCE_MS = 300;
// If the freshly rendered PDF hasn't reported "loaded" by then, show it anyway.
const PREVIEW_SWAP_FALLBACK_MS = 2500;

/**
 * invoice-confirm-modal-extraction (2026-10): the invoice-generation panel,
 * factored out of booking-detail-modal.tsx so the three entry points that
 * can trigger invoice generation — right after Cobrar, Facturas > Pendientes,
 * and a client's own booking history — share one implementation. Any future
 * rule is written once here and applies everywhere.
 *
 * invoice-edit-before-generate (2026-11): it is now also a PREVIEW. The
 * clinic can edit the client name, DNI, address, the extra concept, a note
 * and the amount, and sees a live "BORRADOR" PDF of exactly what will be
 * generated. Nothing is created until it confirms. Edits apply to this
 * invoice only (DNI/address also update the client's profile, as before).
 *
 * Self-contained: fetches the client's current DNI/address and the
 * appointment's name/price itself (given only ids) rather than requiring
 * each caller to prefetch them.
 */
export function InvoiceConfirmModal({
  bookingId,
  clinicClientId,
  clientEmail,
  // invoice-concepts-list: the booking's own appointment type — always the
  // invoice's first line, shown but not editable here (changing what the
  // appointment actually was is the separate, parked Cobrar-time
  // override feature).
  serviceName,
  dict,
  onClose,
  onDone,
}: {
  bookingId: string;
  clinicClientId: string | null;
  clientEmail: string;
  serviceName: string;
  dict: InvoicingDictionary["confirmModal"];
  onClose: () => void;
  onDone: () => void;
}) {
  const realEmail = hasRealEmail(clientEmail);
  const [datalistId] = useState(() => `invoice-concepts-${++conceptsDatalistSeq}`);

  const [emailInput, setEmailInput] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [nameInput, setNameInput] = useState("");
  const [dniInput, setDniInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  // invoice-concepts-list: an OPTIONAL extra line on top of the service
  // name above — picked from the business's list or typed fresh (a fresh
  // value is auto-added to the list on submit).
  const [extraConceptInput, setExtraConceptInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  // The appointment's own price — what "modified" is measured against.
  const [servicePrice, setServicePrice] = useState<number | null>(null);
  const [concepts, setConcepts] = useState<string[]>([]);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview (a blob URL of the draft PDF).
  // The PDF being shown, and the next one loading in a hidden second viewer
  // (swapped in when ready, so the preview never blanks while it updates).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  // side-panel-pattern (rollout, 2026-10) — same shell/transition as
  // AppointmentModal/BookingDetailModal: slides in from the right over
  // the main content, leaving the sidebar visible on desktop.
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [identity, defaults, conceptList] = await Promise.all([
        clinicClientId ? getClientIdentity(clinicClientId) : Promise.resolve(null),
        getInvoiceBookingDefaults(bookingId),
        listInvoiceConcepts(),
      ]);
      if (cancelled) return;
      setDniInput(identity?.dni ?? "");
      setAddressInput(identity?.address ?? "");
      setNameInput(defaults?.clientName ?? "");
      if (defaults) {
        setServicePrice(defaults.servicePrice);
        setAmountInput(formatAmount(defaults.servicePrice));
      }
      setConcepts(conceptList.map((c) => c.label));
      setLoadingDefaults(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [clinicClientId, bookingId]);

  const amountValue = parseAmount(amountInput);
  const amountModified = servicePrice !== null && !Number.isNaN(amountValue) && Math.abs(amountValue - servicePrice) >= 0.005;

  // Live preview: refreshes ~300ms after the last keystroke, cancelling a
  // stale request when something changes. The new PDF loads in a hidden
  // second viewer and replaces the visible one only once it is ready.
  const shownRef = useRef<string | null>(null);
  const pendingRef = useRef<string | null>(null);

  const promote = useCallback((url: string) => {
    if (pendingRef.current !== url) return; // superseded by a newer one
    if (shownRef.current) URL.revokeObjectURL(shownRef.current);
    shownRef.current = url;
    pendingRef.current = null;
    setPreviewUrl(url);
    setPendingUrl(null);
  }, []);

  useEffect(() => {
    if (loadingDefaults || Number.isNaN(amountValue)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewFailed(false);
      try {
        const res = await fetch("/api/invoices/draft-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            bookingId,
            clientName: nameInput,
            clientDni: dniInput,
            clientAddress: addressInput,
            extraConcept: extraConceptInput,
            note: noteInput,
            amount: amountValue,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const url = URL.createObjectURL(await res.blob());
        // A newer PDF replaces one that never finished loading.
        if (pendingRef.current) URL.revokeObjectURL(pendingRef.current);
        pendingRef.current = url;
        if (!shownRef.current) {
          promote(url); // the first one: nothing to keep visible, show it now
        } else {
          setPendingUrl(url);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setPreviewFailed(true);
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadingDefaults, bookingId, nameInput, dniInput, addressInput, extraConceptInput, noteInput, amountValue, promote]);

  // Safety net: some browsers never fire the viewer's load event.
  useEffect(() => {
    if (!pendingUrl) return;
    const t = setTimeout(() => promote(pendingUrl), PREVIEW_SWAP_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [pendingUrl, promote]);

  useEffect(
    () => () => {
      if (shownRef.current) URL.revokeObjectURL(shownRef.current);
      if (pendingRef.current) URL.revokeObjectURL(pendingRef.current);
    },
    []
  );

  async function handleConfirm() {
    const email = emailInput.trim();
    if (sendEmail && !realEmail && !email) {
      setError(dict.errEmailRequired);
      return;
    }
    const name = nameInput.trim();
    if (!name) {
      setError(dict.errNameRequired);
      return;
    }
    const dni = dniInput.trim();
    const address = addressInput.trim();
    if (!dni || !address) {
      setError(dict.errClientIdentityRequired);
      return;
    }
    if (Number.isNaN(amountValue)) {
      setError(dict.errAmountInvalid);
      return;
    }
    const extraConcept = extraConceptInput.trim();
    const concept = extraConcept ? `${serviceName}\n${extraConcept}` : serviceName;

    setBusy(true);
    setError(null);
    const res = await createAndSendInvoice({
      bookingId,
      sendEmail,
      alternateEmail: email || undefined,
      saveToProfile: sendEmail && !realEmail && !!email,
      clientDni: dni,
      clientAddress: address,
      concept,
      extraConcept: extraConcept || undefined,
      clientName: name,
      amount: amountValue,
      note: noteInput.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // auto-open-invoice-pdf: the generated PDF opens in a new tab right
    // away, same as if the clinic had clicked "Descargar" themselves,
    // instead of only landing back on the appointment panel.
    window.open(invoicePdfHref(res.invoice), "_blank", "noopener,noreferrer");
    requestClose(onDone);
  }

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink disabled:opacity-60";

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-[60] md:left-[240px]">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={() => !busy && closePanel()}
        aria-hidden
      />
      <div
        className={`absolute inset-y-0 right-0 flex h-full w-full flex-col overflow-y-auto bg-surface p-5 shadow-2xl transition-transform duration-200 ease-out sm:p-6 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-ink">{dict.title}</h2>
          <button
            onClick={() => !busy && closePanel()}
            aria-label={dict.close}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:flex-row">
          {/* ── Form ─────────────────────────────────────────────── */}
          <div className="flex flex-col lg:w-[420px] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
            <div className="mb-4 flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{dict.serviceLabel}</label>
                <p className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink">
                  {serviceName}
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{dict.conceptLabel}</label>
                <input
                  value={extraConceptInput}
                  onChange={(e) => {
                    setExtraConceptInput(e.target.value);
                    setError(null);
                  }}
                  placeholder={dict.conceptPlaceholder}
                  list={datalistId}
                  disabled={loadingDefaults}
                  className={inputClass}
                />
                <datalist id={datalistId}>
                  {concepts.map((label) => (
                    <option key={label} value={label} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{dict.amountLabel}</label>
                <input
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setError(null);
                  }}
                  inputMode="decimal"
                  disabled={loadingDefaults}
                  className={`${inputClass} ${Number.isNaN(amountValue) && amountInput ? "border-error" : ""}`}
                />
                {amountModified && servicePrice !== null && (
                  <p className="mt-1 text-[11.5px] text-amber-700">
                    {dict.amountModifiedHint.replace("{price}", formatAmount(servicePrice))}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{dict.nameLabel}</label>
                <input
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    setError(null);
                  }}
                  disabled={loadingDefaults}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{dict.dniLabel}</label>
                <input
                  value={dniInput}
                  onChange={(e) => {
                    setDniInput(e.target.value);
                    setError(null);
                  }}
                  placeholder={dict.dniPlaceholder}
                  disabled={loadingDefaults}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{dict.addressLabel}</label>
                <input
                  value={addressInput}
                  onChange={(e) => {
                    setAddressInput(e.target.value);
                    setError(null);
                  }}
                  placeholder={dict.addressPlaceholder}
                  disabled={loadingDefaults}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{dict.noteLabel}</label>
                <textarea
                  value={noteInput}
                  onChange={(e) => {
                    setNoteInput(e.target.value);
                    setError(null);
                  }}
                  placeholder={dict.notePlaceholder}
                  maxLength={300}
                  rows={2}
                  disabled={loadingDefaults}
                  className={inputClass}
                />
              </div>
            </div>

            <label className="mb-4 flex items-center gap-2 text-[13px] font-medium text-ink">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => {
                  setSendEmail(e.target.checked);
                  setError(null);
                }}
                className="h-4 w-4 rounded border-line"
              />
              {dict.sendEmailCheckboxLabel}
            </label>

            {sendEmail && (
              <div className="mb-4">
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">
                  {realEmail ? dict.alternateEmailLabel : dict.missingEmailLabel}
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder={realEmail ? dict.alternateEmailPlaceholder : dict.missingEmailPlaceholder}
                  className={inputClass}
                />
              </div>
            )}

            {error && (
              <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[13px] text-error">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Btn onClick={handleConfirm} disabled={busy || loadingDefaults}>
                {busy ? dict.sending : sendEmail ? dict.yesGenerateAndSend : dict.yesGenerateOnly}
              </Btn>
            </div>
          </div>

          {/* ── Live preview ─────────────────────────────────────── */}
          <div className="flex min-h-[360px] flex-col lg:min-h-0 lg:flex-1">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-ink-soft">{dict.previewTitle}</p>
              {previewLoading && <p className="text-[11.5px] text-ink-soft">{dict.previewUpdating}</p>}
            </div>
            {previewFailed && <p className="mb-2 text-[12px] text-error">{dict.previewError}</p>}
            {previewUrl && (
              <>
                {/* Inline PDF viewers are unreliable on phones/tablets: there, a link opens it in a tab instead. */}
                <div className="relative hidden min-h-0 w-full flex-1 lg:block">
                  {/* Keyed by URL: when the pending PDF is promoted, its viewer is kept
                      (no reload) and the old one is removed, so nothing flashes. */}
                  {[previewUrl, pendingUrl].filter((u): u is string => !!u).map((url) => (
                    <iframe
                      key={url}
                      src={`${url}#navpanes=0&zoom=100`}
                      title={url === previewUrl ? dict.previewTitle : ""}
                      aria-hidden={url !== previewUrl}
                      tabIndex={url === previewUrl ? 0 : -1}
                      onLoad={url === pendingUrl ? () => promote(url) : undefined}
                      className={`absolute inset-0 h-full w-full rounded-lg border border-line bg-surface-2 ${
                        url === previewUrl ? "" : "pointer-events-none opacity-0"
                      }`}
                    />
                  ))}
                </div>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-semibold text-brand hover:underline lg:hidden"
                >
                  {dict.previewOpenTab}
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
