/**
 * payment-cancellation-flow-expansion (workflows/calendar-management-past.md):
 * the Cobrar modal's non-bono payment method list. English codes (per
 * CLAUDE.md's internationalization-ready convention — stored codes stay
 * English, Spanish is display-label-only, mapped via the calendar
 * dictionary's paymentMethod* keys), a plain array so it's easy to swap for
 * a DB-driven per-clinic `clinic_payment_methods` list later (backlog —
 * not built) without changing any call site's shape.
 */
export const PAYMENT_METHOD_CODES = [
  "cash",
  "card",
  "bank_transfer",
  "bizum",
  "direct_debit",
  "paypal",
  "other",
] as const;

export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];
