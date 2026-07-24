# Kalendar — Session Start Prompt

Copy this whole prompt into a NEW Claude conversation to start a scoped work
session. Fill in a fresh GitHub PAT before sending — never commit a real PAT
into this file.

Companion docs: `CLAUDE.md` (project-wide architecture) and `MODULES.md`
(per-feature file map). This prompt tells Claude to read only those two files
first, then ask which module to scope into — instead of reading the whole repo.

---

```
I'm working on Kalendar by KaminoLabs — a SaaS appointment booking platform for
Spanish-speaking clinics and independent professionals, initially targeting Madrid.
The goal is €1M ARR.

GitHub repo: stanize/kaminolabs-kalendar (branch main)
GitHub PAT: <PASTE FRESH PAT HERE>
Stack: Next.js 16 + TypeScript + Tailwind v4 + Zustand + Supabase (DB only, not
Supabase Auth) + Better Auth + Vercel

Instructions for this session:
1. Staleness check before cloning: run `git ls-remote <repo-url> refs/heads/main`
   and compare its SHA to `git -C /tmp/repo rev-parse HEAD` (if `/tmp/repo`
   already exists from earlier in this session). If they match, skip re-cloning
   and skip `npm install` — edit in place. If they differ, or `/tmp/repo`
   doesn't exist yet, do a full clone (+ install if needed).
2. Read ONLY CLAUDE.md and MODULES.md at the start — do not read any other files yet.
3. Write /tmp/gitpush.py (single-commit Git Trees API push helper) so it's ready
   for later, but don't push anything yet. It must run
   `git fetch origin main --quiet && git reset --soft origin/main` after every
   successful push, so local HEAD stays in sync with what was just pushed and
   the staleness check in step 1 stays accurate on the next turn.
4. Once you've read both docs, ask me which module/feature we're working on this
   session (list the module names from MODULES.md as options). Only after I answer,
   read the specific files listed for that module (+ its declared shared-infra
   dependencies) — not the rest of the repo.
5. If I say I changed something directly on GitHub, treat that as a signal to
   re-run the staleness check (it should already catch this automatically, but
   don't skip it if I mention it explicitly).
```

---

## Keeping this in sync

This file is maintained ad hoc — not tied to `RESYNC.md`'s cadence (that file
only keeps `CLAUDE.md`/`MODULES.md` accurate against the codebase). Update this
prompt yourself whenever the session-start workflow changes — e.g. if the
staleness-check or push method changes, a new setup step is added, or the
module list structure changes enough that the "ask which module" step needs
adjusting.
