# Points to Consider

> Behaviors that look like bugs (or were reported as one) but have been
> reviewed and intentionally left as-is, plus anything else worth flagging for
> a future decision without blocking current work. Not a bug tracker — if
> something needs fixing, it goes in the backlog instead. This file is for
> "we noticed this, thought about it, and here's why it's fine (for now)."
>
> Format per entry: what was observed → why it's not being changed → what
> would make us revisit it.

---

### Google OAuth "login" silently creates an account if one doesn't exist

**Observed**: Testing with a wiped database, using the "Continue with Google"
button on the *login* screen (not signup) for an account that doesn't exist
yet creates a brand-new account and signs the user straight into the panel,
instead of showing an error.

**Why it's fine as-is**: This is standard Better Auth / OAuth-provider
behavior — there's no separate "sign up with Google" vs "log in with Google"
call, both flows hit the same `authClient.signIn.social()` and the provider
creates the account on first login if needed. It matches expectations for
most SaaS products ("Continue with Google" just works) and avoids a confusing
dead-end for someone who actually meant to sign up. Only surfaced because of
deliberate fresh-data testing, not a real user path.

**Revisit if**: We want gated/invite-only signup, or need to control the
funnel a new clinic account enters through (e.g. force through a pricing
page first). Blocking this would require deciding what UX happens instead
(error message? redirect to a signup page pre/post account-creation?) since
OAuth is a redirect flow — non-trivial, and not worth it pre-launch.

---
