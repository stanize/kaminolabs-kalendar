/**
 * Fire-and-forget: sends a client-side error to /api/log-client-error so it
 * shows up in Vercel's runtime logs (queryable the same way server-side
 * errors already are), instead of only ever existing in this one browser's
 * console. Never throws, never blocks the caller — reporting a failure
 * should never itself become a second failure.
 *
 * label should be a short, greppable tag identifying the call site (e.g.
 * "signUp.email", "createSubscriptionIntent") so a Vercel log query for
 * that label finds every failure at that spot, not just this one.
 */
export function reportClientError(
  label: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    void fetch("/api/log-client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, message, stack, context }),
      // Doesn't need to complete before the page navigates away (e.g. the
      // user closing the modal right after a failure) — keepalive lets the
      // browser finish sending it in the background regardless.
      keepalive: true,
    }).catch(() => {
      // Reporting itself failing (offline, blocked, etc.) is not worth
      // surfacing anywhere — silently drop it.
    });
  } catch {
    // Never let error reporting throw.
  }
}
