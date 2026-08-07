# Workflow: Appointment Reminders

Automated 24h and 1h reminder emails for confirmed bookings.

## Step: scheduler
Status: done
Criteria:
- Supabase pg_cron + pg_net job runs on a */15 cadence as primary scheduler
- GitHub Actions workflow exists but is manual-trigger-only fallback (not on a schedule)
- CRON_SECRET is used to authenticate the cron-triggered endpoint

## Step: idempotency
Status: done
Criteria:
- kalendar_bookings has reminder_24h_sent_at and reminder_1h_sent_at columns
- Reminder job checks these columns before sending to avoid duplicate sends
- Columns are set only after a confirmed successful send

## Step: send-reminder
Status: done
Criteria:
- 24h-before and 1h-before reminder emails are triggered for confirmed bookings only
- Emails sent via Resend REST API (lib/email.ts)
- Reminder emails pinned to Spanish via EMAIL_LOCALE constant

## Step: failure-visibility
Status: done
Criteria:
- reminder_send_failed / last_reminder_error columns exist on kalendar_bookings
- Failure surfaces as a marker on the calendar week-view chip
- Failure detail (error text) shown in the booking detail modal
- No retry UI or notification system exists yet (visibility-only, by design)

## Step: secret-rotation-sync
Status: done
Criteria:
- CRON_SECRET is kept in sync across Vercel env var, GitHub Actions repo secret, and Supabase Vault (cron_secret)

## Notes / Deviations
(freeform — anything found in code that doesn't map to a defined step)
