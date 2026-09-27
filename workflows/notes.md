# Notes

Cross-cutting observations, context, or things to check later that aren't
tied to one specific feature workflow (e.g. a competitor detail that
doesn't fit competitor-tracking.md, a codebase quirk noticed in passing, a
question to ask Arun next time that doesn't block anything right now).

- **Pre-launch security/performance audit not yet run** (2026-09-27, Arun
  uploaded a detailed brief). Tracked as its own workflow file,
  `workflows/security-performance-audit.md` — a full DB-security,
  code/IP-protection, and production-performance pass across the
  Supabase RLS/grant posture, app-layer auth boundary, and load
  readiness, to run before the first real clinic goes live. Not started;
  see that file for the full brief and ground rules (never run DDL
  directly, verify every claim against real code, deliver the report in
  chat before pushing anything).
