/**
 * Shared detection for the synthetic client_email WhatsApp guest bookings
 * carry, purely to satisfy kalendar_bookings.client_email's NOT NULL
 * constraint (that column stays required — see
 * workflows/whatsapp-booking.md's data-model step, not made nullable
 * deliberately). Never a real address a clinic could contact.
 *
 * Deliberately NOT server-only — used both by lib/email.ts (server, to skip
 * sending) and by client components rendering booking/client details (to
 * hide the row instead of showing a confusing fake-looking email).
 *
 * `.invalid` is kept alongside the current `.dev` domain so already-existing
 * booking/client rows in the live DB that predate the 2026-09-22 rename are
 * also recognized, not just new ones.
 */
const WHATSAPP_SENTINEL_EMAIL_DOMAINS = ["@whatsapp.kalendar.dev", "@whatsapp.kalendar.invalid"];

export function isWhatsappSentinelEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return WHATSAPP_SENTINEL_EMAIL_DOMAINS.some((domain) => lower.endsWith(domain));
}
