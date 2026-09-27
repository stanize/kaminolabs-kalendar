/**
 * The KLNDR-NNNN error code catalog (workflows/error-monitoring.md,
 * structured-event-log step, 2026-09-27). One fixed, permanent code per
 * registered failure/event kind — assigned once, at the logEvent() call
 * site, and reused every time that same kind recurs. This is what makes a
 * code useful as a stable reference in support conversations, docs, or a
 * future runbook ("that's KLNDR-0019 again") — unlike the row's own id
 * (unique per occurrence) or its tag (shared across several distinct
 * failure kinds, e.g. every "whatsapp"-tagged failure).
 *
 * RULES:
 *   - Never renumber or reuse a retired code — if a call site is deleted,
 *     retire its constant (leave a comment) rather than recycling the
 *     number, so a code found in an old log row or support thread never
 *     silently starts meaning something else.
 *   - Always append new codes at the end (next number after the current
 *     highest), never insert into a gap.
 *   - Ad-hoc debug logEvent() calls (Arun's temporary troubleshooting logs)
 *     are NOT registered here — they pass no code, and kalendar_error_log's
 *     code column is nullable for exactly that reason.
 */
export const ERROR_CODES = {
  PANEL_SESSION_FAILED: "KLNDR-0001", // app/panel/layout.tsx — getSession() threw
  PANEL_ROLES_FAILED: "KLNDR-0002", // app/panel/layout.tsx — getUserRoles() threw
  PANEL_ROLES_SLOW: "KLNDR-0003", // app/panel/layout.tsx — getUserRoles() took >3s
  PANEL_ASSIGN_ROLE_FAILED: "KLNDR-0004", // app/panel/layout.tsx — assignRole() threw
  PANEL_ASSIGN_ROLE_SLOW: "KLNDR-0005", // app/panel/layout.tsx — assignRole() took >3s
  AUTH_POOL_IDLE_CLIENT_ERROR: "KLNDR-0006", // lib/auth.ts — pg Pool idle-client error
  BOOKING_STATUS_UPDATE_FAILED: "KLNDR-0007", // lib/actions/booking-owner.ts — status/payment update failed (also covers a sync_bono_session_usage trigger failure)
  BOOKING_COUNTERS_UPDATE_FAILED: "KLNDR-0008", // lib/actions/booking-owner.ts — post-update client-counter recalc failed
  WHATSAPP_MANUAL_CONFIRMATION_FAILED: "KLNDR-0009", // lib/actions/booking-owner.ts — manual-booking WhatsApp confirmation send failed
  BOOKING_NOTE_COPY_FAILED_OWNER: "KLNDR-0010", // lib/actions/booking-owner.ts — createBookingAsOwner note copy failed
  BOOKING_NOTE_COPY_FAILED_GUEST: "KLNDR-0011", // lib/actions/booking.ts — submitBookingImpl note copy failed
  EMAIL_SKIPPED_WHATSAPP_SENTINEL: "KLNDR-0012", // lib/email.ts — send skipped, synthetic WhatsApp guest address (expected)
  EMAIL_SKIPPED_NOT_CONFIGURED: "KLNDR-0013", // lib/email.ts — send skipped, RESEND_API_KEY unset (expected)
  EMAIL_SEND_FAILED: "KLNDR-0014", // lib/email.ts — Resend returned a non-2xx response
  EMAIL_SEND_EXCEPTION: "KLNDR-0015", // lib/email.ts — fetch to Resend threw
  RATE_LIMIT_INCREMENT_FAILED: "KLNDR-0016", // lib/rate-limit.ts — increment_rate_limit_hit RPC failed
  REMINDERS_FETCH_FAILED: "KLNDR-0017", // app/api/cron/send-reminders — candidate-booking query failed
  REMINDERS_RUN_SUMMARY: "KLNDR-0018", // app/api/cron/send-reminders — every run's sent24/sent1/failed summary
  REMINDERS_SEND_FAILED: "KLNDR-0019", // app/api/cron/send-reminders — a single 24h/1h reminder email failed
  PRICING_PHASE_NOTIFY_FETCH_FAILED: "KLNDR-0020", // app/api/cron/pricing-phase-notify — business query failed
  PRICING_PHASE_NOTIFY_BUSINESS_FAILED: "KLNDR-0021", // app/api/cron/pricing-phase-notify — one business's notify failed
  PRICING_PHASE_NOTIFY_RUN_SUMMARY: "KLNDR-0022", // app/api/cron/pricing-phase-notify — every run's notified-count summary
  STRIPE_RECONCILE_FETCH_FAILED: "KLNDR-0023", // app/api/cron/stripe-reconcile — business query failed
  STRIPE_RECONCILE_MISMATCH: "KLNDR-0024", // app/api/cron/stripe-reconcile — stored status disagrees with Stripe's (likely missed webhook)
  STRIPE_RECONCILE_BUSINESS_FETCH_FAILED: "KLNDR-0025", // app/api/cron/stripe-reconcile — one business's Stripe fetch failed
  STRIPE_RECONCILE_RUN_SUMMARY: "KLNDR-0026", // app/api/cron/stripe-reconcile — every run's checked/mismatch summary
  WHATSAPP_SERVICE_LIST_SEND_FAILED: "KLNDR-0027", // app/api/whatsapp/webhook — sendServiceListMessage failed, fell back to text
  WHATSAPP_PLAIN_MESSAGE_SEND_FAILED: "KLNDR-0028", // app/api/whatsapp/webhook — plainTextBefore send failed
  WHATSAPP_DATE_LIST_SEND_FAILED: "KLNDR-0029", // app/api/whatsapp/webhook — sendDateListMessage failed, fell back to text
  WHATSAPP_TIME_LIST_SEND_FAILED: "KLNDR-0030", // app/api/whatsapp/webhook — sendTimeListMessage failed, fell back to text
  WHATSAPP_QUICK_REPLY_SEND_FAILED: "KLNDR-0031", // app/api/whatsapp/webhook — sendQuickReplyMessage failed, fell back to text
  STRIPE_WEBHOOK_NOT_CONFIGURED: "KLNDR-0032", // app/api/webhooks/stripe — STRIPE_WEBHOOK_SECRET/client unset
  STRIPE_WEBHOOK_SIGNATURE_INVALID: "KLNDR-0033", // app/api/webhooks/stripe — signature verification failed
  STRIPE_WEBHOOK_MISSING_BUSINESS_REF: "KLNDR-0034", // app/api/webhooks/stripe — checkout.session.completed missing client_reference_id
  STRIPE_WEBHOOK_PAYMENT_SUCCEEDED: "KLNDR-0035", // app/api/webhooks/stripe — invoice.payment_succeeded (informational, not a failure)
  STRIPE_WEBHOOK_PROCESSING_ERROR: "KLNDR-0036", // app/api/webhooks/stripe — event handling threw
  CLIENT_REPORTED_ERROR: "KLNDR-0037", // app/api/log-client-error — any browser-reported error via reportClientError()
  PROVISION_PATIENT_FETCH_FAILED: "KLNDR-0038", // lib/actions/patient.ts — patient-row fetch failed
  PROVISION_PATIENT_NO_ROW: "KLNDR-0039", // lib/actions/patient.ts — no row found after insert+fetch
  SUBSCRIPTION_INTENT_NO_CLIENT_SECRET: "KLNDR-0040", // lib/actions/billing.ts — createSubscriptionIntent found no usable client secret
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
