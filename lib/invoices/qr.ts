import "server-only";
import QRCode from "qrcode";

/**
 * invoice-qr-verification (spec-invoice-qr.md): pre-VeriFACTU, every
 * invoice's QR points at this Kalendar-hosted public verification page.
 * When VeriFACTU is enabled per clinic (future — see kalendar_businesses'
 * not-yet-built verifactu_enabled flag), this is the one place that swaps
 * to the deterministic AEAT URL — the QR embed code itself never changes,
 * only the URL passed into it.
 */
export function buildVerificationUrl(invoiceId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  return `${base}/invoice/verify/${invoiceId}`;
}

/**
 * A PNG data URI embeddable directly as a react-pdf <Image src=.../>.
 * `margin: 4` (the library's own default — restored explicitly here so a
 * future change to that default doesn't silently shrink it) gives a
 * proper quiet zone around the code, needed at the ~35mm print size the
 * VeriFactu-matched PDF layout renders this at (lib/invoices/templates/
 * vat-exempt.tsx) for reliable scanning.
 */
export async function generateQrDataUri(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 400,
    margin: 4,
    color: { dark: "#111827", light: "#ffffff" },
  });
}
