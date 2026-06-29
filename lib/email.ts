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

/**
 * Email notifying the business owner that a guest just confirmed a booking.
 * Spanish copy.
 */
export function ownerBookingNotificationHtml(input: {
  businessName: string;
  serviceName: string;
  whenLabel: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  providerName?: string | null;
  panelUrl: string;
}): string {
  const { serviceName, whenLabel, clientName, clientEmail, clientPhone, providerName, panelUrl } = input;
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px;color:#64748b;font-size:14px;">${escapeHtml(label)}</td><td style="padding:4px 12px;font-size:14px;text-align:right;">${escapeHtml(value)}</td></tr>`;
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Nueva reserva confirmada</h1>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Tienes una nueva reserva confirmada.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;padding:8px;margin:0 0 24px;">
      ${row("Servicio", serviceName)}
      ${row("Cuándo", whenLabel)}
      ${providerName ? row("Profesional", providerName) : ""}
      ${row("Cliente", clientName)}
      ${row("Email", clientEmail)}
      ${clientPhone ? row("Teléfono", clientPhone) : ""}
    </table>
    <a href="${panelUrl}" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 24px; border-radius: 12px;">
      Ver en mi calendario
    </a>
  </div>`;
}

/**
 * Email to the client confirming their booking was cancelled. Spanish copy.
 */
export function bookingCancelledClientHtml(input: {
  clientName: string;
  businessName: string;
  serviceName: string;
  whenLabel: string;
  byOwner: boolean;
}): string {
  const { clientName, businessName, serviceName, whenLabel, byOwner } = input;
  const greeting = clientName ? `Hola ${escapeHtml(clientName)},` : "Hola,";
  const reason = byOwner
    ? `Tu reserva en <strong>${escapeHtml(businessName)}</strong> ha sido cancelada por el negocio.`
    : `Tu reserva en <strong>${escapeHtml(businessName)}</strong> ha sido cancelada.`;
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Reserva cancelada</h1>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">${greeting}</p>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">${reason}</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;padding:8px;margin:0 0 8px;">
      <tr><td style="padding:8px 12px;color:#64748b;font-size:14px;">Servicio</td><td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(serviceName)}</td></tr>
      <tr><td style="padding:4px 12px;color:#64748b;font-size:14px;">Cuándo</td><td style="padding:4px 12px;font-size:14px;text-align:right;">${escapeHtml(whenLabel)}</td></tr>
    </table>
  </div>`;
}

/**
 * Email to the owner notifying that a client cancelled their booking. Spanish.
 */
export function bookingCancelledOwnerHtml(input: {
  serviceName: string;
  whenLabel: string;
  clientName: string;
  providerName?: string | null;
}): string {
  const { serviceName, whenLabel, clientName, providerName } = input;
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Reserva cancelada</h1>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Un cliente ha cancelado su reserva.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;padding:8px;margin:0;">
      <tr><td style="padding:8px 12px;color:#64748b;font-size:14px;">Servicio</td><td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(serviceName)}</td></tr>
      <tr><td style="padding:4px 12px;color:#64748b;font-size:14px;">Cuándo</td><td style="padding:4px 12px;font-size:14px;text-align:right;">${escapeHtml(whenLabel)}</td></tr>
      ${providerName ? `<tr><td style="padding:4px 12px;color:#64748b;font-size:14px;">Profesional</td><td style="padding:4px 12px;font-size:14px;text-align:right;">${escapeHtml(providerName)}</td></tr>` : ""}
      <tr><td style="padding:4px 12px;color:#64748b;font-size:14px;">Cliente</td><td style="padding:4px 12px;font-size:14px;text-align:right;">${escapeHtml(clientName)}</td></tr>
    </table>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Long Spanish date+time in Europe/Madrid, e.g. "martes, 15 de julio · 10:00". */
export function formatBookingWhen(startIso: string): string {
  const d = new Date(startIso);
  const date = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  const time = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${date} · ${time}`;
}

/**
 * Email asking a guest to confirm their pending booking. Clicking the link
 * activates the reservation. Spanish copy.
 */
export function bookingConfirmEmailHtml(input: {
  clientName: string;
  businessName: string;
  serviceName: string;
  whenLabel: string;
  providerName?: string | null;
  confirmUrl: string;
  cancelUrl: string;
}): string {
  const { clientName, businessName, serviceName, whenLabel, providerName, confirmUrl, cancelUrl } = input;
  const greeting = clientName ? `Hola ${escapeHtml(clientName)},` : "Hola,";
  const providerLine = providerName
    ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Profesional</td><td style="padding:4px 0;font-size:14px;text-align:right;">${escapeHtml(providerName)}</td></tr>`
    : "";
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Confirma tu reserva</h1>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">${greeting}</p>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Casi listo. Confirma tu reserva en <strong>${escapeHtml(businessName)}</strong> haciendo clic en el botón.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;padding:8px;margin:0 0 24px;">
      <tr><td style="padding:8px 12px;color:#64748b;font-size:14px;">Servicio</td><td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(serviceName)}</td></tr>
      <tr><td style="padding:4px 12px;color:#64748b;font-size:14px;">Cuándo</td><td style="padding:4px 12px;font-size:14px;text-align:right;">${escapeHtml(whenLabel)}</td></tr>
      ${providerLine}
    </table>
    <a href="${confirmUrl}" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 24px; border-radius: 12px;">
      Confirmar mi reserva
    </a>
    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 24px 0 0;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
      <a href="${confirmUrl}" style="color: #0d9488; word-break: break-all;">${confirmUrl}</a>
    </p>
    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 16px 0 0;">
      Si no has hecho esta reserva, puedes ignorar este mensaje.
    </p>
    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 8px 0 0;">
      ¿Necesitas cancelar? <a href="${cancelUrl}" style="color: #0d9488;">Cancela tu reserva aquí</a>.
    </p>
  </div>`;
}
