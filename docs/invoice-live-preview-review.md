# Live invoice preview: tech spec and code (for review)

Written 2026-11-19. Repo: `stanize/kaminolabs-kalendar` (Next.js 16 App Router, React, TypeScript,
Tailwind v4, Supabase via a service-role server client, `@react-pdf/renderer` for PDFs).

**Status, stated plainly:** typechecked, linted and built clean. The first version (single viewer,
700 ms debounce) was used live by the product owner and confirmed working. The latest change
(300 ms debounce plus a hidden "double-buffer" viewer) was pushed afterwards and has **not been
confirmed in a running browser yet**. The double-buffer swap logic is the part most worth reviewing.

## 1. What it is

In the clinic panel, when a clinic generates an invoice for a paid appointment, a side panel shows a
form (client name, DNI, address, extra concept, note, amount, email options) next to a **live PDF
preview** of the invoice that will be created. As the user edits a field, the preview updates by
itself (no manual refresh). **Nothing is saved or numbered by the preview**; the invoice is only
created when the user confirms.

The preview is the real invoice template rendered to a PDF on the server, shown in the browser's
built-in PDF viewer inside an `<iframe>`. It is marked with a "BORRADOR" (draft) watermark and number.

## 2. Requirements

- Preview updates as values are entered, with no page refresh and no clicking a button.
- It must look exactly like the real PDF (same template), so it is a real PDF, not an HTML imitation.
- No writes: no invoice row, no invoice number consumed, nothing persisted.
- Only the owning clinic can request a preview, and only for its own appointments.
- Should not flash blank while updating.
- Works on desktop; on phones/tablets (unreliable inline PDF viewing) show an "open in a new tab" link instead.

## 3. Architecture and data flow

```
 user types in a form field (React state in InvoiceConfirmModal)
        |
        v   useEffect deps change -> clear old timer, abort in-flight request, start a 300 ms timer
 debounce timer fires
        |
        v   fetch POST /api/invoices/draft-preview   {bookingId, clientName, clientDni, clientAddress,
        |                                             extraConcept, note, amount}   (AbortController signal)
        v
 Route handler (server)
   1. session required (401)         2. business of the session user (404)
   3. booking must belong to that business (404)
   4. provider (team member) of the booking  -> title/colegiada/signature on the invoice
   5. build template props: real appointment data + the typed edits, watermark "BORRADOR"
   6. react-pdf renderToBuffer -> application/pdf, Cache-Control: no-store
        |
        v
 browser: res.blob() -> URL.createObjectURL(blob) -> blob: URL
        |
        v   double buffer (see section 4)
 first PDF: shown at once.  later PDFs: load in a hidden second <iframe>, swapped in on its `load` event
 (fallback: swap after 2.5 s if no load event).  Old blob URLs are revoked after the swap.
```

Pre-filled defaults (client name, service price) come from a small server action,
`getInvoiceBookingDefaults`, so the modal needs only a `bookingId`.

## 4. The double-buffer swap (the tricky part)

Problem: pointing one `<iframe>` at a new blob URL makes the browser's PDF viewer reload, which
flashes blank and resets scroll.

Approach, in `invoice-confirm-modal.tsx`:

- Two pieces of state: `previewUrl` (the PDF on screen) and `pendingUrl` (the next PDF, loading).
  Two refs mirror them (`shownRef`, `pendingRef`) so callbacks and cleanup read current values.
- A new PDF arrives: if nothing is shown yet it is promoted immediately; otherwise it becomes
  `pendingUrl` and is rendered in a second `<iframe>` (stacked, `opacity-0`, `pointer-events-none`).
- Both iframes are rendered from one array and **keyed by their blob URL**. When the pending PDF is
  promoted (`previewUrl = pendingUrl`), React keeps that same iframe element (same key, no reload)
  and just changes its classes to visible, while the old iframe is unmounted. This avoids a second
  load of the same PDF, which would flash again.
- `promote(url)` ignores a url that is no longer the current pending one (superseded), revokes the
  previously shown blob URL, and updates state.
- If a newer PDF arrives before the pending one loaded, the unloaded pending blob URL is revoked
  and replaced.
- Safety net: an effect promotes the pending PDF after 2.5 s even if no `load` event fired.
- Unmount cleanup revokes both blob URLs.
- PDF viewer fragment `#navpanes=0&zoom=100` hides the thumbnail pane and sets 100% zoom (Chromium
  viewer parameters; other browsers may ignore them).

Known limits: scroll position resets to the top on each update (the viewer reloads). A truly
in-place update would need an HTML/canvas preview instead of a PDF, rejected because it could drift
from the real PDF layout.

## 5. Security and abuse considerations

- Authenticated by the app's session (`getSession()`); no token-in-URL access like the real invoice PDF.
- Booking lookup is scoped by the session user's `business_id`, so another clinic's booking id is a 404.
- Input is length-capped server-side (name 120, DNI 40, address 200, extra concept 200, note 300).
- Nothing is persisted. The route is POST with a JSON body.
- **Known gap, for reviewers:** no rate limiting on this route. Each request renders a PDF
  (CPU). Authenticated-only and debounced client-side, but a script could call it repeatedly.
  Is a per-user rate limit warranted?
- The preview QR code points at a made-up verification URL and verifies nothing.

## 6. Performance considerations

- One PDF render per debounced edit (about 0.3 s after the last keystroke). Requests in flight are
  aborted client-side when the user keeps typing, but the server may still finish rendering an
  aborted request (Node does not cancel `renderToBuffer`).
- Blob URLs are revoked to avoid memory growth in a long-open panel.

## 7. Questions for reviewers

1. Is relying on the iframe `load` event of a `blob:` PDF reliable across Chrome, Edge, Firefox and
   Safari? Is the 2.5 s fallback sufficient, or could it swap too early/late?
2. Any race conditions between the debounce effect, the abort controller, `promote`, and the two refs?
3. Is keying both iframes by blob URL the right way to avoid a reload on promotion, or is there a
   cleaner pattern (e.g. a single iframe plus a `<object>`/canvas based viewer)?
4. Is the `#navpanes=0&zoom=100` fragment safe to append to a `blob:` URL?
5. Should the server skip work when a newer request supersedes an older one (e.g. via an
   incrementing request id) and should the route be rate limited?
6. Memory/cleanup correctness of `URL.createObjectURL` / `revokeObjectURL` here.

---

## 8. Code

### 8.1 `components/panel/invoice-confirm-modal.tsx` (the whole component; the preview logic is the
`shownRef` / `pendingRef` / `promote` / effects block and the two-iframe render near the bottom)

```tsx
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
```

### 8.2 `app/api/invoices/draft-preview/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { createClient } from "@/lib/supabase/server";
import { getProviderForBooking } from "@/lib/invoices/data";
import { renderInvoiceDraftPdf } from "@/lib/invoices/preview";

// invoice-edit-before-generate (pdf-invoicing.md): a live "BORRADOR" PDF of
// the invoice about to be generated, built from the appointment plus the
// fields the clinic has edited so far. Authenticated by session; the booking
// must belong to the caller's own business. Creates, saves and numbers
// nothing.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const business = await getBusinessForUser(session.user.id);
  if (!business) return NextResponse.json({ error: "No business" }, { status: 404 });

  let body: {
    bookingId?: string;
    clientName?: string;
    clientDni?: string;
    clientAddress?: string;
    extraConcept?: string;
    note?: string;
    amount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("kalendar_bookings")
    .select("id, team_member_id, client_name, service_name, service_price")
    .eq("id", body.bookingId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const provider = await getProviderForBooking(business.id, booking.team_member_id);

  const amount = typeof body.amount === "number" && Number.isFinite(body.amount) ? body.amount : Number(booking.service_price);
  const extra = (body.extraConcept ?? "").trim().slice(0, 200);
  const pdf = await renderInvoiceDraftPdf(business, provider, {
    clientName: (body.clientName ?? "").trim().slice(0, 120) || booking.client_name,
    clientDni: (body.clientDni ?? "").trim().slice(0, 40),
    clientAddress: (body.clientAddress ?? "").trim().slice(0, 200),
    serviceName: extra ? `${booking.service_name}\n${extra}` : booking.service_name,
    amount,
    note: (body.note ?? "").trim().slice(0, 300) || null,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
  });
}
```

### 8.3 `lib/invoices/preview.ts` (renders the draft or sample PDF)

```ts
import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { Business } from "@/lib/business/data";
import { buildBusinessSnapshot } from "@/lib/invoices/data";
import { templateBusinessFromSnapshot } from "@/lib/invoices/render";
import { getInvoiceTemplate } from "@/lib/invoices/templates";
import type { InvoiceTemplateProps } from "@/lib/invoices/templates/types";
import { buildVerificationUrl, generateQrDataUri } from "@/lib/invoices/qr";

// invoice-preview (pdf-invoicing.md): a sample invoice built from the
// clinic's CURRENT settings and made-up client/service data, so the clinic
// can see what its invoices look like. Nothing is created or saved and no
// invoice number is consumed. Marked "EJEMPLO" (watermark + number) so it
// can never pass for a real invoice.
const INTL_LOCALE = "es-ES";
const TZ = "Europe/Madrid";

export const PREVIEW_WORD = "EJEMPLO";

export interface PreviewProvider {
  name: string;
  professional_dni: string | null;
  professional_college_number: string | null;
  professional_title: string | null;
  signature_url: string | null;
}

interface PreviewContent {
  client: { name: string; dni: string; address: string };
  serviceName: string;
  amount: number;
  note: string | null;
  /** Printed as the invoice number and as the watermark, e.g. "EJEMPLO" / "BORRADOR". */
  word: string;
}

async function renderPreviewDocument(
  business: Business,
  provider: PreviewProvider | null,
  content: PreviewContent
): Promise<Buffer> {
  const template = getInvoiceTemplate(business.invoice_template_id);
  const snapshot = buildBusinessSnapshot(business, provider);

  // A placeholder URL — a preview invoice does not exist, so the QR points
  // at a made-up id (it will not verify anything).
  const verificationUrl = buildVerificationUrl("ejemplo");
  const qrDataUri = await generateQrDataUri(verificationUrl);

  const props: InvoiceTemplateProps = {
    business: templateBusinessFromSnapshot(snapshot),
    client: content.client,
    invoiceNumberFormatted: content.word,
    issueDate: new Intl.DateTimeFormat(INTL_LOCALE, { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(
      new Date()
    ),
    serviceName: content.serviceName,
    amount: content.amount,
    paid: true,
    verificationUrl,
    qrDataUri,
    watermark: content.word,
    note: content.note,
  };

  const element = createElement(template.component, props) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

/** Settings > Facturación's "Vista previa": made-up client and service. */
export async function renderInvoicePreviewPdf(business: Business, provider: PreviewProvider | null): Promise<Buffer> {
  return renderPreviewDocument(business, provider, {
    client: { name: "Paciente Ejemplo", dni: "00000000T", address: "Calle Ejemplo 1, 28001 Madrid" },
    serviceName: "Sesión de ejemplo",
    amount: 50,
    note: null,
    word: PREVIEW_WORD,
  });
}

export const DRAFT_WORD = "BORRADOR";

export interface DraftInvoiceContent {
  clientName: string;
  clientDni: string;
  clientAddress: string;
  /** The final line-item text (service name, plus the optional extra line). */
  serviceName: string;
  amount: number;
  note: string | null;
}

/**
 * invoice-edit-before-generate: the REAL appointment's data plus whatever the
 * clinic has typed so far, marked "BORRADOR" — nothing is created or numbered.
 */
export async function renderInvoiceDraftPdf(
  business: Business,
  provider: PreviewProvider | null,
  draft: DraftInvoiceContent
): Promise<Buffer> {
  return renderPreviewDocument(business, provider, {
    client: { name: draft.clientName, dni: draft.clientDni, address: draft.clientAddress },
    serviceName: draft.serviceName,
    amount: draft.amount,
    note: draft.note,
    word: DRAFT_WORD,
  });
}
```

### 8.4 `lib/invoices/data.ts` (excerpt: the provider lookup used by the route)

```ts
/**
 * The team member whose title/colegiada/signature an invoice for this
 * booking shows (the booking's assigned provider), or null. Scoped to the
 * business so a forged id can't read another clinic's member.
 */
export async function getProviderForBooking(
  businessId: string,
  teamMemberId: string | null
): Promise<{
  name: string;
  professional_dni: string | null;
  professional_college_number: string | null;
  professional_title: string | null;
  signature_url: string | null;
} | null> {
  if (!teamMemberId) return null;
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("kalendar_team_members")
    .select("name, professional_dni, professional_college_number, professional_title, signature_url")
    .eq("id", teamMemberId)
    .eq("business_id", businessId)
    .maybeSingle();
  return member ?? null;
}
```

### 8.5 `lib/actions/invoices.ts` (excerpt: the defaults the modal loads)

```ts
/**
 * invoice-edit-before-generate: the appointment's own client name and service
 * price, which pre-fill the generate-invoice panel's editable fields. Scoped
 * to the caller's business.
 */
export const getInvoiceBookingDefaults = authedAction(
  async (session, bookingId: string): Promise<{ clientName: string; servicePrice: number } | null> => {
    const business = await getBusinessForUser(session.user.id);
    if (!business) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("kalendar_bookings")
      .select("client_name, service_price")
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .maybeSingle();
    return data ? { clientName: data.client_name as string, servicePrice: Number(data.service_price) } : null;
  }
);
```

### 8.6 `lib/invoices/templates/vat-exempt.tsx` (excerpts: the watermark)

```tsx
// style
  // invoice-preview: big, light, rotated word behind the content.
  watermark: {
    position: "absolute",
    top: 360,
    left: 55,
    fontSize: 100,
    fontWeight: 700,
    color: "#e5e7eb",
    transform: "rotate(-28deg)",
  },
  // ...inside StyleSheet.create({ ... })

// sizing helper
// Sizes the preview watermark so a longer word ("BORRADOR") still fits the
// page, and keeps it horizontally centered (A4 is ~595pt wide; a bold glyph
// is roughly 0.68 of the font size wide).
function watermarkSize(word: string): { fontSize: number; left: number } {
  const fontSize = Math.min(100, Math.floor(430 / (word.length * 0.68)));
  const width = word.length * 0.68 * fontSize;
  return { fontSize, left: Math.max(0, (595 - width) / 2) };
}

// usage, first child of <Page>
        {watermark && (
          <Text style={[styles.watermark, watermarkSize(watermark)]} fixed>
            {watermark}
          </Text>
        )}
```

## 9. Related files not reproduced here

- `lib/invoices/templates/vat-exempt.tsx` (the full invoice layout), `lib/invoices/templates/types.ts`
  (props, including `watermark` and `note`).
- `lib/invoices/qr.ts` (placeholder QR), `lib/invoices/render.ts` (renders real, saved invoices).
- `lib/actions/invoices.ts` `createAndSendInvoice`, which creates the real invoice on confirm.
