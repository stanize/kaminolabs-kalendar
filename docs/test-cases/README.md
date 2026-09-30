# Test cases — repo snapshot

`test-cases.md` is a git-tracked snapshot of the admin portal's testing
tracker catalog (`kalendar_test_cases`, see
`workflows/admin-portal-tools.md`'s `testing-tracker` step). It's a
handoff/backup artifact, not the live source of truth — the database is
what the admin portal actually reads/writes; this file exists so Arun has
something durable to hand a Claude session, and something diffable in git
history.

**Format**: one test case per line, exactly what the admin portal's
bulk-import box (`/admin/testing/cases`) reads and its "Download all (.md)"
button produces —
`seq_no | title | description | url | test data | priority | category | subcategory | expected result | automatable`.
No header line, no comments — anything that isn't a valid data line becomes
a junk test case on import, so keep this file pure data.

`seq_no` is the stable identity a previous export carried (`kalendar_test_cases.seq_no`,
auto-assigned, never reused) — it's how a re-imported file UPDATES the
matching existing row instead of creating a duplicate. Leave it blank for
a genuinely new case (including every case in this repo file before its
first real import, since none has a DB-assigned `seq_no` yet); a session
adding cases here should always leave new lines' `seq_no` blank rather than
inventing one. `category`/`subcategory` are free text, not a fixed
taxonomy — same low-ceremony pattern as `priority`. `automatable` is
`yes`/blank.

Older 5-field lines (`title | description | url | test data | priority`,
no `seq_no`/category/etc.) still import fine — every trailing field left
off is just treated as unset, and they're always inserted as new cases.

## Update convention

Before `test-cases.md` is overwritten with a new version, copy the CURRENT
version into `history/` first, named
`test-cases-<YYYY-MM-DDTHHMMSSZ>.md` (UTC timestamp of the backup, not the
edit). Only then replace `test-cases.md` with the new content. This keeps a
real history of how the catalog evolved without relying on `git log` alone
being the only way to see an old version's full content at a glance.

## Round-trip

1. Arun edits cases live in the admin portal (add, edit priorities, mark
   results in a testing project, etc.).
2. When he wants a repo snapshot, he downloads the current catalog via
   "Download all (.md)" and hands it to a Claude session (or a session
   regenerates/extends the catalog itself, e.g. after a repo-wide scan for
   new features).
3. That session backs up the current `test-cases.md` into `history/` per
   the convention above, then writes the new content into `test-cases.md`
   and commits.
4. Arun uploads the new `test-cases.md` via bulk import to bring the
   database back in sync.
