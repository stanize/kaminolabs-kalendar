import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { getInvoiceById } from "@/lib/invoices/data";
import { formatInvoiceNumber } from "@/lib/invoices/types";

const INTL_LOCALE = "es-ES";
const TZ = "Europe/Madrid";

/**
 * invoice-qr-verification (spec-invoice-qr.md): the public page a
 * scanned invoice QR opens — no auth, no patient-identifying data (no
 * name/DNI/address), just enough to confirm the factura is genuine.
 * Calls getInvoiceById directly rather than fetching
 * /api/invoice/verify/[id] internally — that route exists for external
 * callers, not for this page to round-trip through itself.
 */
export default async function InvoiceVerifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);

  return (
    <div className="grid min-h-dvh place-items-center bg-surface-2 px-5 py-16">
      <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface p-8 text-center shadow-[0_12px_40px_rgba(15,31,46,.08)]">
        <div className="mb-6 flex justify-center">
          <Logo size={18} />
        </div>

        {!invoice ? (
          <>
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-ink-soft">
              <Icon name="x" size={24} />
            </div>
            <h1 className="mb-1.5 text-[22px]">Factura no encontrada</h1>
            <p className="m-0 text-[14.5px] text-ink-soft">
              Este enlace de verificación no corresponde a ninguna factura.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-brand-weak text-brand-ink">
              <Icon name="check" size={24} />
            </div>
            <h1 className="mb-1.5 text-[22px]">Factura verificada por Kalendar</h1>
            <p className="mb-6 text-[14.5px] text-ink-soft">
              Esta factura fue emitida a través de Kalendar.
            </p>

            <dl className="flex flex-col gap-3 rounded-xl bg-surface-2/50 p-4 text-left text-[14px]">
              <Row label="Nº de factura" value={formatInvoiceNumber(invoice.issue_year, invoice.invoice_number)} />
              <Row
                label="Fecha de emisión"
                value={new Intl.DateTimeFormat(INTL_LOCALE, {
                  timeZone: TZ, day: "numeric", month: "long", year: "numeric",
                }).format(new Date(invoice.created_at))}
              />
              <Row
                label="Emisor"
                value={
                  invoice.business_snapshot.isSolo
                    ? invoice.business_snapshot.professionalName || invoice.business_snapshot.name
                    : invoice.business_snapshot.name
                }
              />
              {invoice.business_snapshot.legalId && <Row label="NIF" value={invoice.business_snapshot.legalId} />}
              <Row label="Importe total" value={`${invoice.amount.toFixed(2).replace(".", ",")} €`} />
              <Row label="Estado" value="Emitida" />
            </dl>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
