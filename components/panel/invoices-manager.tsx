"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { resendInvoice } from "@/lib/actions/invoices";
import { formatInvoiceNumber, type InvoiceRow } from "@/lib/invoices/types";
import type { PendingInvoiceBooking } from "@/lib/invoices/data";
import type { InvoicingDictionary } from "@/lib/i18n/dictionaries/invoicing";
import { reportClientError } from "@/lib/report-client-error";
import { InvoiceConfirmModal } from "@/components/panel/invoice-confirm-modal";

function pdfHref(invoice: InvoiceRow): string {
  return `/api/invoices/${invoice.id}/pdf?token=${invoice.access_token}`;
}

// invoice-concepts-list: service_name is "Servicio\nConcepto adicional"
// when an extra concept was added — the Servicio filter should only ever
// offer/match the first line (the actual appointment type), never the
// combined string with the additional concept baked in.
function serviceLine(serviceName: string): string {
  return serviceName.split("\n")[0];
}

// facturas-pending-tab (2026-10): Generadas/Pendientes — a paid booking
// with no invoice yet (the post-Cobrar prompt was declined, or it's from
// before this feature existed) sits in Pendientes rather than vanishing;
// "No" at Cobrar time now means "later", not "never". One shared
// InvoiceConfirmModal generates from either tab.
export function InvoicesManager({
  invoices,
  pendingBookings,
  dict,
  confirmModalDict,
}: {
  invoices: InvoiceRow[];
  pendingBookings: PendingInvoiceBooking[];
  dict: InvoicingDictionary["page"];
  confirmModalDict: InvoicingDictionary["confirmModal"];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"generated" | "pending">("generated");
  const [generatingBookingId, setGeneratingBookingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [service, setService] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [patientName, setPatientName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  // free-text-invoice-search: matches across the whole invoice record
  // (client, service + any additional concept, payment method, amount,
  // invoice number) rather than one field at a time.
  const [searchText, setSearchText] = useState("");

  const services = useMemo(() => [...new Set(invoices.map((i) => serviceLine(i.service_name)))].sort(), [invoices]);

  const methodLabel = (m: InvoiceRow["payment_method"]) => {
    switch (m) {
      case "cash": return dict.paymentMethodCash;
      case "card": return dict.paymentMethodCard;
      case "bono": return dict.paymentMethodBono;
      case "bank_transfer": return dict.paymentMethodBankTransfer;
      case "bizum": return dict.paymentMethodBizum;
      case "direct_debit": return dict.paymentMethodDirectDebit;
      case "paypal": return dict.paymentMethodPaypal;
      case "other": return dict.paymentMethodOther;
      default: return "—";
    }
  };

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (dateFrom && new Date(inv.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(inv.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
      if (service && serviceLine(inv.service_name) !== service) return false;
      if (paymentMethod && inv.payment_method !== paymentMethod) return false;
      if (patientName && !inv.client_name.toLowerCase().includes(patientName.toLowerCase())) return false;
      if (invoiceNumber && !formatInvoiceNumber(inv.issue_year, inv.invoice_number).includes(invoiceNumber)) return false;
      if (q) {
        const methodText =
          inv.payment_method === "cash" ? dict.paymentMethodCash
          : inv.payment_method === "card" ? dict.paymentMethodCard
          : inv.payment_method === "bono" ? dict.paymentMethodBono
          : "";
        const haystack = [
          inv.client_name,
          inv.client_email,
          inv.service_name,
          formatInvoiceNumber(inv.issue_year, inv.invoice_number),
          methodText,
          inv.amount.toFixed(2),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, dateFrom, dateTo, service, paymentMethod, patientName, invoiceNumber, searchText, dict]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-line">
        <TabButton active={tab === "generated"} onClick={() => setTab("generated")}>
          {dict.tabGenerated}
        </TabButton>
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
          {dict.tabPending}
          {pendingBookings.length > 0 && (
            <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">
              {pendingBookings.length}
            </span>
          )}
        </TabButton>
      </div>

      {tab === "generated" ? (
        invoices.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-10 text-center">
            <p className="text-[15px] font-semibold text-ink">{dict.emptyTitle}</p>
            <p className="mt-1 text-[13.5px] text-ink-soft">{dict.emptySubtitle}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4">
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-ink-soft">{dict.filterDateFrom}</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink" />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-ink-soft">{dict.filterDateTo}</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink" />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-ink-soft">{dict.filterService}</label>
                <select value={service} onChange={(e) => setService(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink">
                  <option value="">{dict.filterServiceAll}</option>
                  {services.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-ink-soft">{dict.filterPaymentMethod}</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink">
                  <option value="">{dict.filterPaymentMethodAll}</option>
                  <option value="cash">{dict.paymentMethodCash}</option>
                  <option value="card">{dict.paymentMethodCard}</option>
                  <option value="bono">{dict.paymentMethodBono}</option>
                  <option value="bank_transfer">{dict.paymentMethodBankTransfer}</option>
                  <option value="bizum">{dict.paymentMethodBizum}</option>
                  <option value="direct_debit">{dict.paymentMethodDirectDebit}</option>
                  <option value="paypal">{dict.paymentMethodPaypal}</option>
                  <option value="other">{dict.paymentMethodOther}</option>
                </select>
              </div>
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder={dict.filterPatientName}
                className="min-w-[160px] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
              />
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder={dict.filterInvoiceNumber}
                className="min-w-[160px] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
              />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={dict.filterSearch}
                className="min-w-[200px] flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
              />
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-xl border border-line bg-surface p-6 text-center text-[13.5px] text-ink-soft">{dict.noResults}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((inv) => (
                  <InvoiceRowItem key={inv.id} invoice={inv} dict={dict} methodLabel={methodLabel} />
                ))}
              </div>
            )}
          </>
        )
      ) : pendingBookings.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center">
          <p className="text-[15px] font-semibold text-ink">{dict.pendingEmptyTitle}</p>
          <p className="mt-1 text-[13.5px] text-ink-soft">{dict.pendingEmptySubtitle}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pendingBookings.map((b) => (
            <div
              key={b.id}
              className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{b.clientName}</p>
                <p className="truncate text-[12.5px] text-ink-soft">
                  {b.serviceName} · {methodLabel(b.paymentMethod)} · {b.amount.toFixed(2)} €
                </p>
              </div>
              <Btn variant="outline" size="sm" className="shrink-0" onClick={() => setGeneratingBookingId(b.id)}>
                {dict.generateInvoice}
              </Btn>
            </div>
          ))}
        </div>
      )}

      {generatingBookingId && (
        <InvoiceConfirmModal
          bookingId={generatingBookingId}
          clinicClientId={pendingBookings.find((b) => b.id === generatingBookingId)?.clinicClientId ?? null}
          clientEmail={pendingBookings.find((b) => b.id === generatingBookingId)?.clientEmail ?? ""}
          serviceName={pendingBookings.find((b) => b.id === generatingBookingId)?.serviceName ?? ""}
          dict={confirmModalDict}
          onClose={() => setGeneratingBookingId(null)}
          onDone={() => {
            setGeneratingBookingId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${
        active ? "border-brand text-brand-ink font-semibold" : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function InvoiceRowItem({
  invoice,
  dict,
  methodLabel,
}: {
  invoice: InvoiceRow;
  dict: InvoicingDictionary["page"];
  methodLabel: (m: InvoiceRow["payment_method"]) => string;
}) {
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      const result = await resendInvoice({ invoiceId: invoice.id });
      if (!result.ok) setError(result.error);
    } catch (e) {
      reportClientError("resendInvoice", e);
      setError("No se pudo reenviar.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink">
          {formatInvoiceNumber(invoice.issue_year, invoice.invoice_number)} · {invoice.client_name}
        </p>
        <p className="truncate text-[12.5px] text-ink-soft">
          {invoice.service_name} · {methodLabel(invoice.payment_method)} · {invoice.amount.toFixed(2)} €
          {invoice.sent_at && ` · ${new Date(invoice.sent_at).toLocaleDateString()}`}
        </p>
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a href={pdfHref(invoice)} target="_blank" rel="noopener noreferrer">
          <Btn variant="outline" size="sm">
            <Icon name="externalLink" size={13} />
            {dict.download}
          </Btn>
        </a>
        <Btn variant="outline" size="sm" onClick={handleResend} disabled={resending}>
          {resending ? dict.resending : dict.resend}
        </Btn>
      </div>
    </div>
  );
}
