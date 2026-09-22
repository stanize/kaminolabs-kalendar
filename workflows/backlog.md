# Backlog

Nice-to-have features or improvements that are real candidates eventually,
but not committed to or scoped yet. A short bullet with a one-line
rationale is enough. Promote an entry to a real `## Step:` in the relevant
feature workflow file once it's actually decided to be built, and remove it
from here at that point — don't duplicate.

- **Admin-portal tool: merge a WhatsApp guest client record into a patient portal account** (2026-09-22, Arun, low priority). Once WhatsApp guest bookings dedupe by phone (see `workflows/whatsapp-booking.md`), a patient who also has a real portal account ends up with two separate `kalendar_clients` rows for the same business — one linked via `patient_id` (portal), one matched via phone (WhatsApp). Arun's call: not worth building live self-service verification (discussed: a WhatsApp-reply-based one-time code is the sound approach if this ever gets built — proves phone ownership without any OTP/SMS infra or Meta template-approval friction, since it's just a normal inbound reply — but a plain "send an unsolicited code to a typed number" OTP flow is NOT the right shape, ruled out during discussion). For now, handle it manually via `kaminolabs-kalendar-admin` — an admin tool that lets Arun pick two `kalendar_clients` rows for the same business and merge them (re-point bookings/counters from one onto the other, delete the duplicate). Not scoped or started.
