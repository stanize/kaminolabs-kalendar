# Sales video (pilot outreach)

A short sales video (TikTok/Reels/Shorts first, YouTube cut second) for
independent physios, osteopaths, psychologists and small-clinic owners in
Spain, to go with the pilot outreach flyer. Drafted from an external
framework doc (2026-11-10) written without repo access, then corrected
against the real repo state on the same day (see "Corrections").

Goal: a viewer replies on WhatsApp to see a demo and join the 6-month free
pilot. Offer: 6 months free, direct feedback to the designer, a tool shaped
around their practice. One promise for the whole video: *"Tu agenda,
ordenada y llena, en un solo lugar."*

## Writing rules (apply to all on-screen text and voiceover)

- State what is present and what is gained. Avoid "no", "no more",
  "without", "don't" (the audience is therapists). Example: "Todas tus
  citas en un solo calendario".
- No invented numbers. Any statistic needs a verified source, otherwise
  replace it with a plain statement. Time claims about the product (e.g.
  "reserva en 1 minuto") are only used after timing the real flow.
- One idea per slide: 3 to 6 words on screen, one short voiceover line.
- Spanish first. The English cut reuses the visuals (see english-cut).

## Corrections to the source framework (verified 2026-11-10)

- **Clip E (manual booking / Pendientes) was out of date.** Guest bookings
  are confirmed immediately on submit (since 2026-09), so there is no
  "confirm requests with a tap" step to show. Reframe E as adding a booking
  yourself from the calendar, including booking into an occupied slot
  (`force-insert-double-booking`, done, live-tested).
- **Invoicing deserves a clip (G)** but only after testing: the whole chain
  is coded (`pdf-invoicing.md`: PDF generation, Facturas page with filters
  and resend, send on payment, QR) yet every step is `in_progress`, pending
  Arun's testing. Do not claim VeriFactu compliance (`verifactu-compliance.md`
  is `not_started`; the QR is not a VeriFactu mark). Do not say invoices are
  issued automatically: `auto-invoice-setting` is `on_hold`; the existing
  trigger fires on payment.
- **Reminders (clip C) are safe** (24 h and 1 h emails, done). WhatsApp
  reminders are `blocked`, so never imply them.
- **Do not feature the WhatsApp booking bot** (`conversation-flow` is
  `in_progress`).
- **Booking wizard (clip A):** `visible-progress-indicator` and
  `appointment-summary-recap` are `in_progress`. Check how that screen looks
  before recording.
- **Leave out drag-to-reschedule** for now (`in_progress`). Several support
  tickets ask for it, so it is a good later clip.
- **English cut:** guest emails are pinned to Spanish via `EMAIL_LOCALE`
  (`lib/email.ts`), so an English cut of clip C would still show Spanish
  unless the pin is lifted or the clip is replaced by a template screenshot.

## Step: video-script-and-scope
Status: not_started
Criteria:
- Format. Short (primary): 9:16, 1080x1920, 35 to 50 s, large burned-in
  Spanish subtitles. Long (secondary): 16:9, 90 s to 2 min, same clips.
  Build the short first.
- Part 1, slides 1 to 4 (3 to 4 s each in the short cut):
  1. Hook, the pain shown: WhatsApp chat list, paper diary, sticky notes.
     Text *¿Tus citas viven en tantos sitios?* VO "Chats, notas, una agenda
     de papel... las citas de tu consulta repartidas en cinco sitios."
  2. Cost of that setup: empty calendar slot, clock, waiting patient. Text
     *Cada hueco vacío es una sesión perdida* VO "Cuando un paciente olvida
     su cita, esa hora queda vacía en tu agenda." Any stat only with a
     verified citation.
  3. Admin time: practitioner replying on the phone in the evening. Text
     *Tus tardes, para ti* VO "Coordinar horarios por mensaje ocupa horas
     que podrían ser tuyas."
  4. The shift: Kalendar calendar fading in over the clutter. Text *Un
     calendario. Tus pacientes reservan solos.* VO "Con Kalendar, tus
     pacientes reservan online y reciben recordatorios automáticos."
- Part 2, screen-recorded clips (6 to 10 s each, caption + VO):
  - A. Patient books online (public booking page). *Tu paciente reserva
    desde el móvil.* Time the flow before using any "en 1 minuto" claim.
  - B. Confirmation plus calendar file (`lib/booking/ics.ts`). *Cita en su
    calendario al instante.*
  - C. Automatic reminders, a real 24 h / 1 h email landing in an inbox.
    *Recordatorios automáticos.*
  - D. Your calendar, week and day view, a booking opened. *Toda tu semana
    de un vistazo.*
  - E (reframed). Add a booking yourself from the calendar, optionally into
    an occupied slot. *Tú llevas el control de tu agenda.*
  - F. Bonos: catalog, sessions counting down after each visit. *Tus bonos,
    siempre al día.*
  - G (new, gated on invoicing tested). Cobrar then factura: Facturas page,
    PDF, resend. *Tu factura, lista en un clic.* (final wording after
    testing; keep to what actually works).
  - Optional extras: setup checklist with service template picker, the
    clinic's own booking link shared on WhatsApp/Instagram, patient area.
- Closing: slide 7 the offer (*6 meses completamente gratis*, VO "Busco
  profesionales para colaborar: 6 meses gratis, tu opinión directa al
  diseñador y una herramienta a medida de tu consulta."); slide 8 call to
  action (*Escríbeme y te lo enseño*, WhatsApp number + QR to the chat,
  end card KALENDAR by KaminoLabs in the flyer's teal).
- Short-cut timeline (about 45 s): 0-4 hook; 4-8 slides 2+3; 8-12 slide 4;
  12-20 clips A+B; 20-27 clip C; 27-34 clip D; 34-40 offer; 40-45 CTA.
  Add E/F/G to the long cut, or swap one in for D if it records better.
- Explicitly NOT in v1: drag-to-reschedule, WhatsApp bot, WhatsApp
  reminders, VeriFactu claims, any statistic without a source, a
  prospect-personalised version (see personalised-version below).

## Step: invoicing-test-gate
Status: not_started
Criteria:
- Before clip G is recorded, Arun tests the invoicing chain end to end
  (Cobrar, invoice created and numbered, PDF download, email send, Facturas
  page filters, resend) and the relevant `pdf-invoicing.md` steps are
  flipped to `done` or bugs are logged there. Clip G is dropped from v1 if
  this slips; the rest of the video does not wait on it.

## Step: demo-clinic-setup
Status: not_started
Criteria:
- A demo physiotherapy clinic that looks busy and believable: realistic
  services and prices, a small team, a week of bookings, a few bono
  patients with partly used packs.
- Use existing admin tooling in `kaminolabs-kalendar-admin`: demo-account
  creation (`/admin/demo-accounts`), appointment generator
  (`/admin/appointment-gen`), appointment date cycler
  (`/admin/date-cycler`, to keep the calendar current at recording time),
  test patients (`/admin/test-patients`). Not run yet; check each works as
  expected before relying on it.
- RECOMMENDED, pending Arun's confirmation: a throwaway demo account on
  production (local runs need credentials this cloud session does not have).
  Confirm it is flagged `is_demo` so it never collides with
  `admin-account-cleanup.md`'s sweep.
- A reminder email sample for clip C: capture a real reminder to a test
  inbox if reminders can be triggered for the demo account; otherwise
  screenshot the template. Decide when this step starts.

## Step: capture-script
Status: not_started
Criteria:
- Scripted Playwright run that replays clips A to F (and G once gated in)
  against the demo clinic at phone size (vertical cut) and desktop size
  (horizontal cut), so every capture is repeatable and can be re-run after
  UI changes. Chromium and Playwright are available in cloud sessions.
- RECOMMENDED, pending Arun's confirmation: lives in
  `scripts/sales-video/` in the main repo, committed to `main`.
- Output (video files, screenshots) is gitignored, not committed.
- Pauses and cursor movement tuned so each clip reads clearly in 6 to 10 s.

## Step: edit-and-export
Status: not_started
Criteria:
- Arun records the voiceover in his own voice. Edit in a normal video
  editor using the scripted captures as source clips (tooling not
  evaluated; Canva's video tools untested).
- Burned-in large high-contrast subtitles. Export 9:16 first, then 16:9.
- Production checklist: stats verified or dropped; Spanish script reviewed
  for negations and tone; demo clinic populated; clips recorded at both
  sizes; WhatsApp number and QR on the end card; post, then log each
  response in the outreach tracker (`/admin/outreach`).

## Step: english-cut
Status: not_started
Criteria:
- Same visuals, English subtitles and VO. Decide what clips B/C show given
  the Spanish-pinned guest emails (lift `EMAIL_LOCALE` for the recording
  account, or use template screenshots). Not before the Spanish cut is done.

## Step: personalised-version
Status: not_started
Criteria:
- Optional, best leads only: re-record clips on a prospect's own clinic name
  and services, using the demo-account flow in `presales-demo-onboarding.md`
  (and the clinic-prospect-scraper to pre-fill). Decide after the first
  general video has gone out and shown any response.
