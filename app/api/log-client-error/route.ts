import { NextResponse } from "next/server";
import { logEvent } from "@/lib/server-error-log";
import { incrementRateLimitHit, getClientIp } from "@/lib/rate-limit";

// structured-event-log (workflows/error-monitoring.md): generous per-IP daily
// cap. A real browser session hitting a real bug won't come close to this;
// it exists purely to stop a scripted flood turning this unauthenticated
// route into a signal-to-noise attack on kalendar_error_log itself.
const DAILY_LIMIT = 50;

/**
 * Forwards a client-side error into Vercel's runtime logs via console.error
 * AND into kalendar_error_log (structured-event-log, 2026-09-27) — so
 * failures that only ever showed up in a user's browser console become
 * queryable/filterable the same way server-side errors already are. This is
 * what was missing when diagnosing the patient-registration 400
 * (trustedOrigins missing a Vercel domain): the failure was real and
 * reproducible, but invisible to anyone not looking at that specific
 * browser's devtools.
 *
 * Unauthenticated by necessity (fires from any visitor's browser, including
 * anonymous guests on the public booking page) — rate-limited per IP via the
 * same kalendar_rate_limit_hits mechanism booking-abuse-protection uses, to
 * stop a scripted flood from drowning real signal in the now-persisted log
 * table. Fails open: a rate-limit infra hiccup just means uncapped that day,
 * never "client errors stop being logged."
 *
 * Not automatic/global — only errors from code paths that explicitly call
 * reportClientError() (lib/report-client-error.ts) land here. Add that call
 * to other client-side failure points incrementally as they matter.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { label, message, stack, context } = body ?? {};

    const labelStr = typeof label === "string" ? label : "unknown";
    const messageStr = typeof message === "string" ? message.slice(0, 2000) : String(message);
    const stackStr = typeof stack === "string" ? stack.slice(0, 4000) : undefined;
    const url = request.headers.get("referer") ?? undefined;
    const userAgent = request.headers.get("user-agent") ?? undefined;

    console.error("[client-error]", {
      label: labelStr,
      message: messageStr,
      stack: stackStr,
      context: context && typeof context === "object" ? context : undefined,
      url,
      userAgent,
    });

    const ip = getClientIp(request.headers);
    const hits = await incrementRateLimitHit("log_client_error", ip);
    if (hits <= DAILY_LIMIT) {
      void logEvent(labelStr, "error", messageStr, {
        source: "client",
        stack: stackStr,
        requestUrl: url,
        data: { ...(context && typeof context === "object" ? context : {}), userAgent },
      });
    }
  } catch {
    // Malformed body — nothing useful to log, just don't error out.
  }

  // Always 204, even on a malformed/failed report — this endpoint exists to
  // help debugging, it should never itself become a visible failure to the
  // user or throw an unhandled rejection in the caller.
  return new NextResponse(null, { status: 204 });
}
