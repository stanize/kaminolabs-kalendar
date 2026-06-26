import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Thrown by requireSession()/authedAction when no valid session is present.
 * The panel layout already gates UI access, so reaching this normally means a
 * server action was invoked directly, or a session expired mid-flight.
 */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Per-request memoized session lookup. Multiple reads within a single render
 * (or a single action invocation) dedupe to one underlying getSession call.
 * Returns the session, or null when unauthenticated.
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
);

/**
 * Returns a guaranteed-non-null session, throwing UnauthorizedError otherwise.
 * Use in server-component reads (already gated by the panel layout) to obtain
 * session.user.id without manual narrowing, and as the basis for authedAction.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session;
}
