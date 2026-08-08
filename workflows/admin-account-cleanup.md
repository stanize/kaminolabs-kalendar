# Workflow: Admin — Unconfirmed Account Cleanup

Accounts that were created (session live) but never completed email verification accumulate over time — most commonly from a user mistyping their email at sign-up, then registering again with the correct one and abandoning the first. This workflow tracks reviewing and deleting those stale unconfirmed accounts.

## Step: admin-review-surface
Status: not_started
Criteria:
- Admin portal (stanize/kaminolabs-kalendar-admin) has a view listing unconfirmed accounts (user.emailVerified = false)
- List shows account age (created_at) and email, sorted oldest-first
- List is filterable/sortable by age so accounts approaching or past the deletion threshold are easy to spot
- Accounts with associated activity (business, bookings, etc.) that are therefore excluded from auto-deletion are visually flagged, with escalating urgency by age (e.g. amber past 1 month, red/dark-red the older they get) so an admin notices them without the monthly job having to touch them

## Step: deletion-policy
Status: not_started
Criteria:
- Deletion threshold is defined: unconfirmed accounts older than 1 month are eligible for automatic deletion
- Auto-deletion only applies to genuinely clean accounts — unconfirmed AND nothing else has happened on them (no business, no bookings, no other associated data)
- Any unconfirmed account with associated activity is never auto-deleted, regardless of age — it stays in the system and is left for admin-review-surface to flag and an admin to review manually
- Deletion cascades correctly through Better Auth tables (user, session, account, verification) via existing ON DELETE CASCADE FKs

## Step: monthly-cleanup-job
Status: not_started
Criteria:
- A scheduled job (Supabase pg_cron, consistent with the existing reminders/reconciliation cron pattern) runs monthly
- Job selects unconfirmed accounts older than 1 month with no associated activity and deletes them (matches deletion-policy exactly — never touches accounts with associated data)
- Job run is logged (count deleted, timestamp) somewhere reviewable — e.g. kalendar_admin_audit_log, consistent with existing admin audit logging

## Step: manual-override
Status: not_started
Criteria:
- Admin can manually delete a specific unconfirmed account (including ones with associated activity, at their discretion) from the review surface
- Admin can manually exclude/snooze a specific clean account from the next auto-deletion pass if needed (e.g. known test account, or a real user known to be mid-signup)

## Notes / Deviations
- This workflow exists because of an accepted (not-a-bug) design decision in clinic-onboarding.md's sign-up step: a syntactically valid but undeliverable email is allowed to create an account rather than being rejected, so the cleanup burden is handled here instead of blocking sign-up.
