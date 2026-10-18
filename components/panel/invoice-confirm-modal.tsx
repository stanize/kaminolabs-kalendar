"use client";

import { useEffect, useState } from "react";
import { Btn } from "@/components/ui/button";
import { createAndSendInvoice, listInvoiceConcepts } from "@/lib/actions/invoices";
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

/**
 * invoice-confirm-modal-extraction (2026-10): the Sí/No invoice-generation
 * modal, factored out of booking-detail-modal.tsx so the three entry
 * points that can now trigger invoice generation — right after Cobrar,
 * Facturas > Pendientes, and a client's own booking history — share one
 * implementation of the checkbox/email/DNI/Domicilio logic instead of
 * three copies that drift apart. Any future rule (new required field,
 * changed validation) is written once here and applies everywhere.
 *
 * Self-contained: fetches the client's current DNI/address itself (given
 * only clinicClientId) rather than requiring the caller to prefetch it,
 * since each entry point reaches this component with different context
 * already in hand.
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
  const [dniInput, setDniInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  // invoice-concepts-list: an OPTIONAL extra line on top of the service
  // name above — picked from the business's list or typed fresh (a fresh
  // value is auto-added to the list on submit).
  const [extraConceptInput, setExtraConceptInput] = useState("");
  const [concepts, setConcepts] = useState<string[]>([]);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [identity, conceptList] = await Promise.all([
        clinicClientId ? getClientIdentity(clinicClientId) : Promise.resolve(null),
        listInvoiceConcepts(),
      ]);
      if (cancelled) return;
      setDniInput(identity?.dni ?? "");
      setAddressInput(identity?.address ?? "");
      setConcepts(conceptList.map((c) => c.label));
      setLoadingIdentity(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [clinicClientId]);

  async function handleConfirm(wantsInvoice: boolean) {
    if (!wantsInvoice) {
      onClose();
      return;
    }

    const email = emailInput.trim();
    if (sendEmail && !realEmail && !email) {
      setError(dict.errEmailRequired);
      return;
    }
    const dni = dniInput.trim();
    const address = addressInput.trim();
    if (!dni || !address) {
      setError(dict.errClientIdentityRequired);
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
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      onClick={() => !busy && handleConfirm(false)}
    >
      <div className="w-full max-w-[360px] rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[15px] font-bold text-ink">{dict.title}</h3>

        <div className="mb-4 flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{dict.serviceLabel}</label>
            <p className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink">{serviceName}</p>
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
              disabled={loadingIdentity}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink disabled:opacity-60"
            />
            <datalist id={datalistId}>
              {concepts.map((label) => (
                <option key={label} value={label} />
              ))}
            </datalist>
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
              disabled={loadingIdentity}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink disabled:opacity-60"
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
              disabled={loadingIdentity}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink disabled:opacity-60"
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
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink"
            />
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[13px] text-error">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => handleConfirm(false)} disabled={busy}>
            {dict.no}
          </Btn>
          <Btn onClick={() => handleConfirm(true)} disabled={busy || loadingIdentity}>
            {busy ? dict.sending : sendEmail ? dict.yesGenerateAndSend : dict.yesGenerateOnly}
          </Btn>
        </div>
      </div>
    </div>
  );
}
