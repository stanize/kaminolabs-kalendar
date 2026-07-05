# RESYNC — Maintenance Prompt for MODULES.md

Run this in a dedicated session after a feature has shipped and been tested,
before starting the next feature. Do NOT run this mid-feature — it assumes the
repo is in a clean, working state.

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

4. **Check the "Not yet modularized" section** at the bottom — for each item,
   confirm whether it now exists. If it exists, draft a new module section for
   it (following the same format as existing modules) instead of leaving it
   in that list.

5. **Check for entirely new top-level areas** not covered by any module or by
   "Shared infra" — e.g. a new route group, a new `lib/` subfolder. Propose
   a new module section for anything found.

6. **Do NOT blindly rewrite the whole file.** Present a diff-style summary of
   proposed changes first (additions, removals, corrections) and wait for
   confirmation before editing `MODULES.md`. This file is a trusted reference —
   silent, sweeping rewrites defeat the point.

7. Once confirmed, edit `MODULES.md` with the approved changes, update the
   `_Last resynced: <date>_` line at the bottom to today's date, and push via
   `gitpush.py` in a single commit with message `chore: resync MODULES.md`.

8. Also do a quick sanity check on `CLAUDE.md` — it should only contain
   cross-cutting/project-wide info (auth model, DB connection, deploy, i18n
   mechanism), not per-panel-page detail that now belongs in `MODULES.md`.
   Flag (don't auto-fix) anything in `CLAUDE.md` that duplicates or
   contradicts `MODULES.md`.

## What NOT to do during a resync

- Don't fix bugs, refactor code, or start any feature work — flag issues,
  don't fix them, unless explicitly asked.
- Don't remove a module's "Gotchas" bullet just because you didn't verify it
  in this pass — only remove/change what you actually confirmed is wrong.
- Don't skip step 6 (the confirm-before-write step) even if the changes look
  obviously correct.
