/**
 * Minimal transactional-email helper.
 *
 * Sends through Resend's REST API (no SDK dependency) when RESEND_API_KEY is
 * configured. When it is not (e.g. local dev, or before the env var is set in
 * Vercel), it degrades gracefully: it logs the message instead of throwing, so
 * sign-up never fails just because email delivery is not wired up yet.
 *
 * Required env vars for real delivery:
 *   - RESEND_API_KEY  → from https://resend.com (free tier available)
 *   - EMAIL_FROM      → e.g. "Kalendar <no-reply@kaminolabs.dev>"
 *                       (the domain must be verified in Resend). If unset, the
 *                       Resend shared test sender is used, which only delivers
 *                       to the email address of the Resend account owner.
 */
type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const DEFAULT_FROM = "Kalendar <onboarding@resend.dev>";

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.EMAIL_FROM ?? DEFAULT_FROM;

  if (!apiKey) {
    // No provider configured yet — log and move on rather than break sign-up.
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send. to=${to} subject="${subject}"`
    );
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const detail =
        (payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message: unknown }).message)
          : "") || `HTTP ${res.status}`;
      console.error(`[email] Resend send failed: ${detail} (to=${to})`);
      return { ok: false, error: detail };
    }

    const id =
      payload && typeof payload === "object" && "id" in payload
        ? String((payload as { id: unknown }).id)
        : undefined;
    console.log(`[email] sent to=${to} id=${id ?? "unknown"} subject="${subject}"`);
    return { ok: true, id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`[email] Failed to send to=${to}: ${msg}`);
    return { ok: false, error: msg };
  }
}

/** Spanish-language verification email body. */
export function verificationEmailHtml(name: string | null | undefined, url: string): string {
  const greeting = name ? `Hola ${escapeHtml(name)},` : "Hola,";
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Confirma tu email</h1>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">${greeting}</p>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      Gracias por crear tu cuenta en Kalendar. Confirma tu dirección de email para empezar a usar tu panel.
    </p>
    <a href="${url}" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 24px; border-radius: 12px;">
      Confirmar mi email
    </a>
    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 24px 0 0;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
      <a href="${url}" style="color: #0d9488; word-break: break-all;">${url}</a>
    </p>
    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 16px 0 0;">
      Si no has creado esta cuenta, puedes ignorar este mensaje.
    </p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
