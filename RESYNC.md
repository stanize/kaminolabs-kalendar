# RESYNC — Maintenance Prompt for Project Documentation

Run this in a dedicated session after a feature has shipped and been tested,
before starting the next feature. Do NOT run this mid-feature — it assumes the
repo is in a clean, working state.

Scope: this resyncs **both** `MODULES.md` and `CLAUDE.md` against the actual
codebase. Nothing gets edited without your go-ahead — this session's job is to
produce a point-by-point proposal, not to rewrite files on its own judgment.

To use: tell Claude "execute RESYNC.md" (or paste this file's contents as the prompt).

---

## Instructions for Claude

You are performing a maintenance pass, not building a feature. Follow these
steps in order:

1. **Re-clone the repo fresh** into `/tmp/repo` (do not trust any warm clone —
   this session's entire job is to catch drift, so start from a clean state).

2. **Read the full top-level structure**: `app/`, `components/`, `lib/`,
   `supabase/`, 2 levels deep minimum. List every file.

3. **Read the current `MODULES.md`** and go module by module. For each module:
   - Check every file listed under it still exists at that path.
   - Check for new files in the module's owned directories that aren't listed.
   - Check the DB tables listed against the current `supabase/schema_001.sql`
     and `schema_better_auth_001.sql` — flag any table that's renamed, added,
     or removed.
   - Check the "Gotchas" bullets against the actual code — flag anything that
     no longer matches current behavior (e.g. a hardcoded value that changed,
     a pattern that was refactored away).

4. **Check the "Not yet modularized" section** at the bottom of `MODULES.md` —
   for each item, confirm whether it now exists. If it exists, draft a new
   module section for it (following the same format as existing modules)
   instead of leaving it in that list.

5. **Check for entirely new top-level areas** not covered by any module or by
   "Shared infra" — e.g. a new route group, a new `lib/` subfolder. Propose
   a new module section for anything found.

6. **Read the current `CLAUDE.md` line by line against the actual code and
   against `MODULES.md`.** Give this file extra scrutiny — it's the first
   thing every session reads, so stale or wrong content here has the widest
   blast radius. Specifically check:
   - Every claim under Architecture / Key Conventions / Migrations / Known
     Decisions still holds (env var names, file paths, auth flow behavior,
     naming rules).
   - No per-feature detail has crept back in that belongs in `MODULES.md`
     instead (duplication drifts the two docs apart over time).
   - No contradictions between `CLAUDE.md` and the current `MODULES.md`.

7. **Produce a single combined report**, organized as:
   - **CLAUDE.md proposals** (own section, listed first, clearly marked as
     high-attention) — one point per issue: what's wrong or stale, what you
     propose instead, why.
   - **MODULES.md proposals** — same point-by-point format, grouped by module.

   Do NOT bury these in prose. Number each point so it's easy to say "apply
   1, 3, 5" or "explain point 2 more" or "skip 4."

8. **Wait for explicit go-ahead before editing either file.** Acceptable
   responses from the user: approve all, approve a subset by number, or ask
   for clarification on specific points before deciding. Do not proceed to
   edits on an ambiguous response — ask which points are approved.

9. Once approved, apply only the approved points to `CLAUDE.md` and/or
   `MODULES.md`. Update the `_Last resynced: <date>_` line at the bottom of
   `MODULES.md` to today's date. Push both changed files via `gitpush.py` in
   a single commit with message `chore: resync CLAUDE.md and MODULES.md`.

## What NOT to do during a resync

- Don't fix bugs, refactor code, or start any feature work — flag issues,
  don't fix them, unless explicitly asked.
- Don't remove a module's "Gotchas" bullet, or a CLAUDE.md claim, just because
  you didn't verify it in this pass — only propose changing what you actually
  confirmed is wrong or stale.
- Don't skip step 8 (the confirm-before-write step) even if the changes look
  obviously correct or small.
- Don't mix unrelated fixes into the approved edit — if the user approves
  points 1-3, don't also sneak in a point 7 you thought of while editing.
