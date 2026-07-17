# REVIEW — Independent Product & Business Analysis Prompt

Run this in a dedicated session, separate from feature-building and from
RESYNC sessions. Where RESYNC.md keeps documentation honest against the code,
REVIEW.md steps back and judges the *product* against the business goal.

To use: tell Claude "execute REVIEW.md as a prompt" (or paste this file's contents).

This session produces a written analysis. **It does not edit, push, or commit
anything** unless I explicitly ask for the report to be archived at the end.

---

## Instructions for Claude

You are acting as an **independent outside analyst** brought in to evaluate
this product — not as the engineer who built it. Drop the collaborative
"what should we build next" framing for this session. Your job is to look at
what actually exists, compare it against the stated business goal, and say
plainly where it's strong, where it's exposed, and what's worth doing next —
including things that haven't been raised before.

### Context to hold throughout

- **Product:** Kalendar by KaminoLabs — appointment booking SaaS for
  Spanish-speaking clinics and independent professionals (physiotherapy,
  nutrition, psychology, beauty, fitness, coaching, tutoring), Madrid market
  first.
- **Business goal:** €1M ARR.
- **Core value proposition as sold:** automate scheduling, reminders, and
  payment collection to cut no-shows and admin overhead for small/independent
  clinics.
- **Buyer:** typically a solo practitioner or small clinic owner — price-
  sensitive, low tolerance for setup friction, likely comparing against
  Calendly/Cal.com/Fresha/Booksy-style tools even if not naming them directly.

Read `CLAUDE.md`, `MODULES.md`, and the latest `RESYNC.md` state for the
technical map, but don't stop there — this session should form its own view,
not just repeat what those docs already say.

### Steps

1. **Re-clone the repo fresh** into `/tmp/repo`. Don't trust any warm clone —
   this session's value depends on seeing the current, complete state.

2. **Check for prior reviews** at `docs/reviews/`. If the folder exists and has
   one or more `<YYYY-MM-DD>-review.md` files, read the **most recent one** in
   full (and skim earlier ones only if useful for spotting a pattern across
   multiple reviews — e.g. the same gap flagged three times running). If the
   folder doesn't exist or is empty, this is the first review — skip straight
   to step 3 and don't force a "since last review" section that has nothing to
   compare against.

3. **Read `CLAUDE.md` and `MODULES.md`** for orientation (stack, module map,
   known gotchas), then **read the actual code** module by module — not just
   file listings. Spend real time in the public booking flow, the panel, and
   the schema, since those are what a paying clinic and their patients
   actually touch.

4. **Build an honest inventory** of what's genuinely working end-to-end today
   vs. what's partially built, stubbed, or documented-but-not-live. Don't
   trust the backlog docs' framing of "built" — verify against the code.

5. **If a prior review exists, compare it against what you just found.** Go
   through that review's "recommended next 3" (and anything it flagged as an
   urgent gap or risk) and classify each one against the current code:
   - **Done** — verify it's actually live, don't take the backlog's word for it.
   - **In progress / partial** — say what's there and what's still missing.
   - **Not started** — flagged but no trace of it in the code.
   - **Deliberately skipped** — if I mentioned in conversation that I chose not
     to pursue something, note that as a decision, not a miss.
   Also note anything that shipped that *wasn't* in the previous review's
   recommendations — useful context, not a problem by itself.

6. **Evaluate against the business goal**, explicitly, in these dimensions:
   - **Revenue mechanics:** Is there anything in the codebase that actually
     collects payment, enforces a paid plan, or gates a premium tier? If the
     product's core pitch includes "payment collection" but nothing bills
     anyone yet, say so plainly — that's a gap between the pitch and the
     product.
   - **No-show reduction:** the stated core value prop. What's actually live
     that reduces no-shows today (reminders? deposits? waitlists?), versus
     what's aspirational?
   - **Time-to-value for a new clinic:** how many steps from signup to a
     bookable public page? Where would a non-technical clinic owner get
     stuck or give up?
   - **Retention/stickiness:** what would make a clinic that tries this stay
     for 6+ months instead of churning back to a spreadsheet or WhatsApp?
   - **Trust/credibility signals:** anything a skeptical solo practitioner
     would need to see (professional-looking public booking page, reliability
     of reminders, data safety) before recommending it to a peer.

7. **Identify blind spots** — things not currently on the tracked backlog that
   an outside analyst would flag. Don't just re-rank the existing backlog;
   actively look for what's missing from it. Consider things like: analytics/
   reporting the owner would want, multi-location or multi-provider scaling,
   compliance/data-handling expectations for health-adjacent data, mobile
   experience, what happens when something fails silently (a reminder email
   bounces, a slot double-books), and anything that would block referral/
   word-of-mouth growth in a tight local market like Madrid clinics.

8. **Flag technical risk that has business consequences** — not general code
   quality nitpicks, but things that would cost revenue or trust if they broke
   in production: single points of failure, anything manual that should be
   automated before scaling past a handful of clinics, and any place the
   architecture would make the next 2-3 backlog items harder than they look.

### Output format

Deliver a single structured report, in this order:

1. **Bottom line** — 3-5 sentences. If I only read this paragraph, what's the
   state of the product relative to €1M ARR, and what's the single biggest
   risk to getting there?
2. **Since the last review** *(omit entirely if this is the first review)* —
   a short table or list: each previously-recommended item, status
   (done / partial / not started / skipped), and one line of what changed.
   Call out anything that's been recommended two reviews running and still
   hasn't moved.
3. **What's genuinely strong** — short, specific, not generic praise.
4. **Gaps that block revenue or retention** — ranked by impact vs. effort,
   each with a one-line "why this matters for €1M ARR."
5. **Blind spots not currently tracked** — the things nobody's written down
   yet.
6. **Technical risk with business consequences** — only what's worth losing
   sleep over, not a full code review.
7. **My recommended next 3** — concrete, ranked, each tied back to a reason.
   If something from the previous review's "next 3" still applies, it's fine
   for it to reappear here — don't drop it just because it was said before.

Be direct. Don't soften findings to be encouraging, and don't pad the report
with things that are fine as-is. If something in the current backlog looks
mis-prioritized against the ARR goal, say so.

### After the report

Ask me whether to archive this report into the repo at
`docs/reviews/<YYYY-MM-DD>-review.md` (create the `docs/reviews/` folder if it
doesn't exist). Only push if I confirm — this session's default output is the
in-chat report, not a commit.
