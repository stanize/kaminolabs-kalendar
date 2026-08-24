import { NextResponse } from "next/server";

/**
 * Forwards a client-side error into Vercel's runtime logs via console.error,
 * so failures that only ever showed up in a user's browser console become
 * queryable the same way server-side errors already are — this is what was
 * missing when diagnosing the patient-registration 400 (trustedOrigins
 * missing a Vercel domain): the failure was real and reproducible, but
 * invisible to anyone not looking at that specific browser's devtools.
 *
 * Deliberately minimal — no persistence, no auth, no rate limiting beyond
 * what's built in here. Not a general-purpose error-tracking pipeline (see
 * the fuller discussion in chat about Sentry as the eventual upgrade path
 * once there's real traffic/paying clinics to justify it); just a cheap way
 * to get a client error into a log Claude/Arun can already query.
 *
 * Not automatic/global — only errors from code paths that explicitly call
 * reportClientError() (lib/report-client-error.ts) land here. Add that call
 * to other client-side failure points incrementally as they matter.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { label, message, stack, context } = body ?? {};

    console.error("[client-error]", {
      label: typeof label === "string" ? label : "unknown",
      message: typeof message === "string" ? message.slice(0, 2000) : String(message),
      stack: typeof stack === "string" ? stack.slice(0, 4000) : undefined,
      context: context && typeof context === "object" ? context : undefined,
      url: request.headers.get("referer") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
  } catch {
    // Malformed body — nothing useful to log, just don't error out.
  }

  // Always 204, even on a malformed/failed report — this endpoint exists to
  // help debugging, it should never itself become a visible failure to the
  // user or throw an unhandled rejection in the caller.
  return new NextResponse(null, { status: 204 });
}
