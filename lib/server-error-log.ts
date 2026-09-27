import { createClient } from "@/lib/supabase/server";

export type LogSeverity = "debug" | "info" | "warning" | "error" | "critical";

/**
 * structured-event-log (workflows/error-monitoring.md): the one shared write
 * path into kalendar_error_log — every existing bracketed-tag
 * console.error/console.log call site calls this too, alongside (never
 * instead of) its existing console call, which stays as the raw Vercel-logs
 * backstop. Also usable directly as an ad-hoc debug log: drop a temporary
 * logEvent("my-tag", "debug", ...) call anywhere while troubleshooting
 * something live, then remove it once done.
 *
 * Fails silently on insert failure (logged to console, never thrown) — a
 * logging outage must never break the thing it's trying to observe.
 */
export async function logEvent(
  tag: string,
  severity: LogSeverity,
  message: string,
  context?: {
    source?: "server" | "client";
    businessId?: string | null;
    stack?: string | null;
    requestUrl?: string | null;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("kalendar_error_log").insert({
      source: context?.source ?? "server",
      tag,
      severity,
      message: message.slice(0, 2000),
      stack: context?.stack?.slice(0, 4000) ?? null,
      business_id: context?.businessId ?? null,
      context: context?.data ?? null,
      environment: process.env.VERCEL_ENV ?? "development",
      request_url: context?.requestUrl ?? null,
    });
    if (error) {
      console.error("[server-error-log] insert failed", { tag, error: error.message });
    }
  } catch (e) {
    console.error("[server-error-log] unexpected failure", { tag, e });
  }
}
