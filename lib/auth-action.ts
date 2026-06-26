import { requireSession } from "@/lib/auth-session";

type AuthedSession = Awaited<ReturnType<typeof requireSession>>;

/**
 * Wraps a server action so it can only run with a valid session, which is
 * injected as the guaranteed first argument. There is no path into the handler
 * that skips the auth check — the guarantee is structural, not a remembered
 * call on the first line of the body.
 *
 * Usage (in a "use server" file):
 *
 *   export const createService = authedAction(
 *     async (session, input: ServiceInput) => {
 *       // session.user.id is guaranteed here
 *     }
 *   );
 *
 * IMPORTANT: keep THIS file free of the "use server" directive. It is a utility,
 * not an action. The directive belongs in the action file, where
 * `export const createX = authedAction(...)` still resolves to an async
 * function (which "use server" requires of every export).
 *
 * On a missing session this THROWS UnauthorizedError. Actions that instead
 * return a graceful { ok: false, error } shape (e.g. the existing support /
 * onboarding actions) keep their own inline check so their error contract — the
 * Spanish message their forms display — is preserved; they are not wrapped.
 */
export function authedAction<TArgs extends unknown[], TResult>(
  handler: (session: AuthedSession, ...args: TArgs) => Promise<TResult>
) {
  return async (...args: TArgs): Promise<TResult> => {
    const session = await requireSession();
    return handler(session, ...args);
  };
}
