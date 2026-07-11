import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? "https://kalendar.kaminolabs.dev",
});

/**
 * Post-auth navigation with a hard-redirect fallback.
 *
 * router.push() is fire-and-forget — there's no promise to await for the soft
 * navigation actually landing, so if the destination's server render hangs
 * (cold start, slow query, etc.) the caller's loading state is stuck forever
 * with no recovery. This mirrors what manually opening a second tab already
 * does (a fresh full-page load bypasses whatever the first tab's soft nav was
 * stuck on) — but automatically, instead of requiring the user to notice and
 * work around it themselves.
 */
export function navigateWithFallback(
  router: { push: (path: string) => void },
  path: string,
  timeoutMs = 6000
): void {
  router.push(path);
  if (typeof window !== "undefined") {
    setTimeout(() => {
      if (window.location.pathname !== path) {
        window.location.href = path;
      }
    }, timeoutMs);
  }
}
