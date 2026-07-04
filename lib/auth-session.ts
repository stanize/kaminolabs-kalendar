import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasRole, type Role } from "@/lib/roles/data";

/**
 * Thrown by requireSession()/requireRole()/authedAction when no valid session
 * is present, or when the user does not hold the required role.
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

/**
 * Returns a guaranteed-non-null session AND verifies the user holds the given
 * role. Throws UnauthorizedError if either check fails. Use this in server
 * actions and server components that require a specific role beyond just being
 * authenticated — e.g. panel actions require 'clinic', patient portal actions
 * require 'patient'.
 */
export async function requireRole(role: Role) {
  const session = await requireSession();
  const ok = await hasRole(session.user.id, role);
  if (!ok) throw new UnauthorizedError(`Role '${role}' required`);
  return session;
}
