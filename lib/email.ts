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
  /** Base64-encoded file content, e.g. from buildBookingIcsBase64(). */
  attachments?: { filename: string; content: string }[];
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const DEFAULT_FROM = "Kalendar <onboarding@resend.dev>";

export async function sendEmail({ to, subject, html, attachments }: SendEmailInput): Promise<SendEmailResult> {
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
      body: JSON.stringify({
        from, to: [to], subject, html,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      }),
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

/**
 * Verification email sent right after sign-up. Owner-facing (the clinic
 * owner creating their account) — localized to whichever language they had
 * selected on the home page navbar (read from the locale cookie), since
 * there's no business.language field yet to drive this properly.
 */
export function verificationEmailHtml(url: string, locale: "es" | "en" = "es"): string {
  const t =
    locale === "en"
      ? {
          heading: "Welcome to Kalendar!",
          greeting: "Hi,",
          intro:
            "Thanks for creating your account. We're glad to have you here — just one step left before you can automate your clinic's admin work and spend more time on your clients.",
          button: "Confirm my email",
          fallback: "If the button doesn't work, copy and paste this link into your browser:",
          ignore: "If you didn't create this account, you can ignore this message.",
        }
      : {
          heading: "¡Bienvenido a Kalendar!",
          greeting: "Hola,",
          intro:
            "Gracias por crear tu cuenta. Nos alegra tenerte aquí — solo falta un paso para que puedas automatizar la gestión de tu clínica y dedicar más tiempo a tus clientes.",
          button: "Confirmar mi email",
          fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
          ignore: "Si no has creado esta cuenta, puedes ignorar este mensaje.",
        };

  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">${t.heading}</h1>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">${t.greeting}</p>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      ${t.intro}
    </p>
    <a href="${url}" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 24px; border-radius: 12px;">
      ${t.button}
    </a>
    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 24px 0 0;">
      ${t.fallback}<br />
      <a href="${url}" style="color: #0d9488; word-break: break-all;">${url}</a>
    </p>
    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 16px 0 0;">
      ${t.ignore}
    </p>
  </div>`;
}

/**
 * Password reset email, sent when a user requests a reset link from
 * /forgot-password. Owner-facing (clinic accounts only — patients don't
 * currently have password reset, see MODULES.md -> auth). Localized the same
 * way as the verification email: from the `kalendar_locale` cookie on the
 * request, since there's no business.language field yet.
 */
export function resetPasswordEmailHtml(url: string, locale: "es" | "en" = "es"): string {
  const t =
    locale === "en"
      ? {
          heading: "Reset your password",
          greeting: "Hi,",
          intro:
            "We received a request to reset the password for your Kalendar account. Click the button below to choose a new one. This link expires in 1 hour.",
          button: "Reset my password",
          fallback: "If the button doesn't work, copy and paste this link into your browser:",
          ignore: "If you didn't request this, you can safely ignore this message — your password won't change.",
        }
      : {
          heading: "Restablece tu contraseña",
          greeting: "Hola,",
          intro:
            "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de Kalendar. Haz clic en el botón para elegir una nueva. Este enlace caduca en 1 hora.",
          button: "Restablecer mi contraseña",
          fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
          ignore: "Si no has solicitado esto, puedes ignorar este mensaje — tu contraseña no cambiará.",
        };

  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">${t.heading}</h1>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">${t.greeting}</p>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      ${t.intro}
    </p>
    <a href="${url}" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 24px; border-radius: 12px;">
      ${t.button}
    </a>
    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 24px 0 0;">
      ${t.fallback}<br />
      <a href="${url}" style="color: #0d9488; word-break: break-all;">${url}</a>
    </p>
    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 16px 0 0;">
      ${t.ignore}
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
  const { businessName, serviceName, whenLabel, clientName, clientEmail, clientPhone, providerName, panelUrl } = input;
  const rows = [
    { label: "Servicio", value: serviceName },
    { label: "Cuándo", value: whenLabel },
    ...(providerName ? [{ label: "Profesional", value: providerName }] : []),
    { label: "Cliente", value: clientName },
    { label: "Email", value: clientEmail },
    ...(clientPhone ? [{ label: "Teléfono", value: clientPhone }] : []),
  ];
  const body = `
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px;"><strong>${escapeHtml(businessName)}</strong> tiene una nueva cita.</p>
    ${emailInfoBox(rows)}
    ${emailButton("Ver en mi calendario", panelUrl)}`;
  return emailShell(body, "Kalendar · Reservas y agenda para tu clínica");
}

/**
 * Email to the client confirming their booking was cancelled. Localized to the
 * guest's chosen language (booking.guest_locale) — GUEST-facing email.
 */
/**
 * Email sent to a GUEST (no account) immediately after they submit a booking.
 * Tells them their request was received and is under clinic review (24h window).
 * GUEST-facing — localized to guest_locale.
 */
export function bookingUnderReviewEmailHtml(input: {
  clientName: string;
  businessName: string;
  serviceName: string;
  whenLabel: string;
  providerName?: string | null;
  cancelUrl: string;
  locale?: "es" | "en";
}): string {
  const { clientName, businessName, serviceName, whenLabel, providerName, cancelUrl } = input;
  const locale = input.locale ?? "es";
  const t =
    locale === "en"
      ? {
          title:        "Booking request received",
          badge:        "Under review",
          greeting:     clientName ? `Hi ${escapeHtml(clientName)},` : "Hi,",
          intro:        `We've received your booking request at <strong>${escapeHtml(businessName)}</strong>. The clinic will confirm it shortly.`,
          note:         "You'll receive a confirmation email once it's approved.",
          service:      "Service",
          when:         "When",
          professional: "Professional",
          cancelPrefix: "Changed your mind?",
          cancelLink:   "Cancel your request here",
          footer:       "Kalendar · Online booking for your clinic",
        }
      : {
          title:        "Solicitud de cita recibida",
          badge:        "En revisión",
          greeting:     clientName ? `Hola ${escapeHtml(clientName)},` : "Hola,",
          intro:        `Hemos recibido tu solicitud de cita en <strong>${escapeHtml(businessName)}</strong>. La clínica la confirmará en breve.`,
          note:         "Recibirás un email de confirmación en cuanto sea aprobada.",
          service:      "Servicio",
          when:         "Cuándo",
          professional: "Profesional",
          cancelPrefix: "¿Has cambiado de opinión?",
          cancelLink:   "Cancela tu solicitud aquí",
          footer:       "Kalendar · Reservas online para tu clínica",
        };
  const rows = [
    { label: t.service, value: serviceName },
    { label: t.when, value: whenLabel },
    ...(providerName ? [{ label: t.professional, value: providerName }] : []),
  ];
  const body = `
    <h1 style="font-size:19px;margin:0 0 12px;">${t.title}</h1>
    ${emailBadge(t.badge, "info")}
    <p style="font-size:15px;line-height:1.6;margin:0 0 6px;">${t.greeting}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">${t.intro}</p>
    ${emailInfoBox(rows)}
    <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0 0 16px;">${t.note}</p>
    ${emailSecondaryLine(t.cancelPrefix, t.cancelLink, cancelUrl)}`;
  return emailShell(body, t.footer);
}

export function bookingCancelledClientHtml(input: {
  clientName: string;
  businessName: string;
  serviceName: string;
  whenLabel: string;
  byOwner: boolean;
  byExpiry?: boolean;
  locale?: "es" | "en";
}): string {
  const { clientName, businessName, serviceName, whenLabel, byOwner } = input;
  const byExpiry = input.byExpiry ?? false;
  const locale = input.locale ?? "es";
  const t =
    locale === "en"
      ? {
          title: "Booking cancelled",
          greeting: clientName ? `Hi ${escapeHtml(clientName)},` : "Hi,",
          reasonByOwner:  `Your booking at <strong>${escapeHtml(businessName)}</strong> has been cancelled by the business.`,
          reasonByGuest:  `Your booking at <strong>${escapeHtml(businessName)}</strong> has been cancelled.`,
          reasonByExpiry: `Your booking request at <strong>${escapeHtml(businessName)}</strong> was not confirmed in time and has been automatically cancelled.`,
          service: "Service",
          when: "When",
        }
      : {
          title: "Cita cancelada",
          greeting: clientName ? `Hola ${escapeHtml(clientName)},` : "Hola,",
          reasonByOwner:  `Tu cita en <strong>${escapeHtml(businessName)}</strong> ha sido cancelada por el negocio.`,
          reasonByGuest:  `Tu cita en <strong>${escapeHtml(businessName)}</strong> ha sido cancelada.`,
          reasonByExpiry: `Tu solicitud de cita en <strong>${escapeHtml(businessName)}</strong> no fue confirmada a tiempo y ha sido cancelada automáticamente.`,
          service: "Servicio",
          when: "Cuándo",
        };
  const reason = byExpiry ? t.reasonByExpiry : byOwner ? t.reasonByOwner : t.reasonByGuest;
  const footer = locale === "en" ? "Kalendar · Online booking for your clinic" : "Kalendar · Reservas online para tu clínica";
  const body = `
    <h1 style="font-size:19px;margin:0 0 12px;">${t.title}</h1>
    ${emailBadge(t.title, "danger")}
    <p style="font-size:15px;line-height:1.6;margin:0 0 6px;">${t.greeting}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">${reason}</p>
    ${emailInfoBox([{ label: t.service, value: serviceName }, { label: t.when, value: whenLabel }])}`;
  return emailShell(body, footer);
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
  const rows = [
    { label: "Servicio", value: serviceName },
    { label: "Cuándo", value: whenLabel },
    ...(providerName ? [{ label: "Profesional", value: providerName }] : []),
    { label: "Cliente", value: clientName },
  ];
  const body = `
    <h1 style="font-size:19px;margin:0 0 12px;">Cita cancelada</h1>
    ${emailBadge("Cancelada por el cliente", "danger")}
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">Un cliente ha cancelado su cita.</p>
    ${emailInfoBox(rows)}`;
  return emailShell(body, "Kalendar · Reservas y agenda para tu clínica");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Shared branded email chrome ─────────────────────────────────────────────
// One visual shell (teal header band with the Kalendar mark, white card body,
// light footer) used by every template below, so all outgoing mail — owner or
// guest-facing, any language — looks like it came from the same product.

const BRAND_TEAL = "#0d9488";
const FONT = "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

function emailShell(bodyHtml: string, footerNote: string): string {
  return `
  <div style="background:#eef2f6;padding:32px 12px;font-family:${FONT};">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
      <div style="background:${BRAND_TEAL};padding:22px 24px;text-align:center;">
        <div style="display:inline-block;width:36px;height:36px;background:rgba(255,255,255,0.18);border-radius:10px;line-height:36px;font-size:17px;color:#ffffff;">📅</div>
        <div style="color:#ffffff;font-weight:700;font-size:15px;margin-top:6px;letter-spacing:.01em;">Kalendar</div>
      </div>
      <div style="padding:30px 26px 8px;color:#0f172a;">
        ${bodyHtml}
      </div>
      <div style="padding:18px 26px 22px;border-top:1px solid #eef2f6;margin-top:20px;">
        <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin:0;text-align:center;">${footerNote}</p>
      </div>
    </div>
  </div>`;
}

function emailBadge(text: string, tone: "success" | "info" | "danger" = "success"): string {
  const colors = {
    success: { bg: "#ecfdf5", fg: "#047857", icon: "✓" },
    info:    { bg: "#eff6ff", fg: "#1d4ed8", icon: "🕐" },
    danger:  { bg: "#fef2f2", fg: "#b91c1c", icon: "✕" },
  }[tone];
  return `
    <div style="display:inline-flex;align-items:center;gap:8px;background:${colors.bg};color:${colors.fg};padding:9px 16px;border-radius:10px;font-weight:600;font-size:13.5px;margin:2px 0 22px;">
      <span>${colors.icon}</span> ${escapeHtml(text)}
    </div>`;
}

function emailInfoBox(
  rows: { label: string; value: string }[],
  tone: "neutral" | "info" = "neutral"
): string {
  const colors = tone === "info" ? { bg: "#eff6ff", label: "#1e40af" } : { bg: "#f8fafc", label: "#64748b" };
  const cells = rows
    .map(
      (r, i) => `
      <tr>
        <td style="padding:${i === 0 ? "0 0 10px" : "10px 0 0"};color:${colors.label};font-size:13.5px;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(r.label)}</td>
        <td style="padding:${i === 0 ? "0 0 10px" : "10px 0 0"};font-size:13.5px;font-weight:600;text-align:right;vertical-align:top;">${escapeHtml(r.value)}</td>
      </tr>`
    )
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;background:${colors.bg};border-radius:14px;margin:0 0 24px;">
      <tr><td style="padding:18px 20px;">
        <table style="width:100%;border-collapse:collapse;"><tbody>${cells}</tbody></table>
      </td></tr>
    </table>`;
}

function emailButton(label: string, url: string): string {
  return `
    <a href="${url}" style="display:block;text-align:center;background:${BRAND_TEAL};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:12px;margin:0 0 18px;">
      ${escapeHtml(label)}
    </a>`;
}

function emailFallbackLink(prefix: string, url: string): string {
  return `
    <p style="font-size:12.5px;line-height:1.6;color:#94a3b8;margin:0 0 18px;">
      ${escapeHtml(prefix)}<br />
      <a href="${url}" style="color:${BRAND_TEAL};word-break:break-all;">${url}</a>
    </p>`;
}

function emailSecondaryLine(prefix: string, linkText: string, url: string): string {
  return `
    <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0 0 4px;">
      ${escapeHtml(prefix)} <a href="${url}" style="color:${BRAND_TEAL};font-weight:600;">${escapeHtml(linkText)}</a>.
    </p>`;
}

/** Long date+time in Europe/Madrid, e.g. "martes, 15 de julio · 10:00" (es) or
 *  "Tuesday, 15 July · 10:00" (en). Defaults to Spanish for owner-facing
 *  emails, which don't yet have a language setting of their own. */
export function formatBookingWhen(startIso: string, locale: "es" | "en" = "es"): string {
  const d = new Date(startIso);
  const intlLocale = locale === "en" ? "en-GB" : "es-ES";
  const date = new Intl.DateTimeFormat(intlLocale, {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  const time = new Intl.DateTimeFormat(intlLocale, {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${date} · ${time}`;
}

/**
 * Email asking a guest to confirm their pending booking. Clicking the link
 * activates the reservation. Localized to the guest's chosen language
 * (booking.guest_locale) — this is a GUEST-facing email.
 */
export function bookingConfirmEmailHtml(input: {
  clientName: string;
  businessName: string;
  serviceName: string;
  whenLabel: string;
  providerName?: string | null;
  confirmUrl: string;
  cancelUrl: string;
  // Destination for the "Gestionar mi cita" button on a CONFIRMED booking.
  // Authenticated-patient bookings should point at the client portal login
  // (they have an account); guest bookings without one fall back to cancelUrl
  // (the tokenized cancel/modify page — no login required).
  manageUrl?: string;
  locale?: "es" | "en";
  // When true, the booking is already confirmed (authenticated patient).
  // Renders a receipt rather than a "please click to confirm" email.
  isConfirmed?: boolean;
  // Whether an .ics calendar file is attached to this email — shows a note
  // pointing the client at the attachment when true.
  hasIcsAttachment?: boolean;
}): string {
  const { clientName, businessName, serviceName, whenLabel, providerName, confirmUrl, cancelUrl } = input;
  const manageUrl = input.manageUrl ?? cancelUrl;
  const isConfirmed = input.isConfirmed ?? false;
  const hasIcs = input.hasIcsAttachment ?? false;
  const locale = input.locale ?? "es";
  const t =
    locale === "en"
      ? {
          titlePending:   "Confirm your booking",
          titleConfirmed: "your appointment is booked",
          badgePending:   "Awaiting confirmation",
          badgeConfirmed: "Booking confirmed",
          greeting: clientName ? `${clientName}` : "Hi,",
          greetingSuffix: ", your appointment is booked.",
          introPending:   `Almost there. Confirm your booking at <strong>${escapeHtml(businessName)}</strong> by clicking the button below.`,
          service:      "Appointment type",
          when:         "Date and time",
          clinic:       "Clinic",
          professional: "Professional",
          button:       "Confirm my booking",
          manageHeading: "Need to make a change?",
          manageBody:   "You can modify or cancel your appointment easily from here:",
          manage:       "Manage my booking",
          fallback:     "If the button doesn't work, copy and paste this link into your browser:",
          ignore:       "If you didn't make this booking, you can ignore this message.",
          cancelPrefix: "Need to cancel or reschedule?",
          cancelLink:   "Manage your booking here",
          thanks:       "Thank you for trusting us.",
          icsPrefix:    "To add this appointment to your calendar, ",
          icsLink:      "download the attached file",
          footer:       "Kalendar · Online booking for your clinic",
        }
      : {
          titlePending:   "Confirma tu cita",
          titleConfirmed: "tu cita ya está planificada",
          badgePending:   "Pendiente de confirmación",
          badgeConfirmed: "Cita confirmada",
          greeting: clientName ? `${clientName}` : "Hola,",
          greetingSuffix: ", tu cita ya está planificada.",
          introPending:   `Casi listo. Confirma tu cita en <strong>${escapeHtml(businessName)}</strong> haciendo clic en el botón.`,
          service:      "Tipo de cita",
          when:         "Fecha y hora",
          clinic:       "Clínica",
          professional: "Profesional",
          button:       "Confirmar mi cita",
          manageHeading: "¿Necesitas hacer algún cambio?",
          manageBody:   "Puedes modificar o cancelar tu cita fácilmente desde aquí:",
          manage:       "Gestionar mi cita",
          fallback:     "Si el botón no funciona, copia y pega este enlace en tu navegador:",
          ignore:       "Si no has solicitado esta cita, puedes ignorar este mensaje.",
          cancelPrefix: "¿Necesitas cancelar?",
          cancelLink:   "Cancela tu cita aquí",
          thanks:       "Gracias por confiar en nosotros.",
          icsPrefix:    "Para añadir esta cita a tu calendario, ",
          icsLink:      "descarga el archivo adjunto",
          footer:       "Kalendar · Reservas online para tu clínica",
        };

  const rows = [
    { label: t.when, value: whenLabel },
    { label: t.clinic, value: businessName },
    { label: t.service, value: serviceName },
    ...(providerName ? [{ label: t.professional, value: providerName }] : []),
  ];

  const title = isConfirmed ? t.titleConfirmed : t.titlePending;
  const badge = isConfirmed
    ? emailBadge(t.badgeConfirmed, "success")
    : emailBadge(t.badgePending, "info");

  const confirmedBody = `
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px;"><strong>${escapeHtml(t.greeting)}</strong>${t.greetingSuffix}</p>
    ${badge}
    ${emailInfoBox(rows, "info")}
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 2px;font-weight:600;">${t.manageHeading}</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 14px;color:#475569;">${t.manageBody}</p>
    ${emailButton(t.manage, manageUrl)}
    <p style="font-size:14.5px;line-height:1.6;margin:20px 0 0;">${t.thanks}</p>
    ${hasIcs ? `<p style="font-size:13px;line-height:1.6;color:#64748b;margin:14px 0 0;">${t.icsPrefix}<strong>${t.icsLink}</strong>.</p>` : ""}`;

  const pendingBody = `
    <h1 style="font-size:19px;margin:0 0 12px;">${title}</h1>
    ${badge}
    <p style="font-size:15px;line-height:1.6;margin:0 0 6px;">${clientName ? `Hola ${escapeHtml(clientName)},` : "Hola,"}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">${t.introPending}</p>
    ${emailInfoBox(rows)}
    ${emailButton(t.button, confirmUrl)}
    ${emailFallbackLink(t.fallback, confirmUrl)}
    <p style="font-size:12.5px;line-height:1.6;color:#94a3b8;margin:0 0 18px;">${t.ignore}</p>
    ${emailSecondaryLine(t.cancelPrefix, t.cancelLink, cancelUrl)}`;

  return emailShell(isConfirmed ? confirmedBody : pendingBody, t.footer);
}
