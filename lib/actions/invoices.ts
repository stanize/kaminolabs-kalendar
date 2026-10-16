"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import { createInvoiceForBooking, getInvoiceForBooking, formatInvoiceNumber, type InvoiceRow } from "@/lib/invoices/data";
import { sendEmail, invoiceEmailHtml } from "@/lib/email";

export interface InvoiceActionDict {
  errNoBusiness: string;
  errNoBooking: string;
  errAlreadyInvoiced: string;
  errCreateFailed: string;
  errSendFailed: string;
  errEmailRequired: string;
  errInvalidEmail: string;
}

const FALLBACK: InvoiceActionDict = {
  errNoBusiness: "No hay negocio.",
  errNoBooking: "Reserva no encontrada.",
  errAlreadyInvoiced: "Esta cita ya tiene una factura.",
  errCreateFailed: "No se pudo crear la factura.",
  errSendFailed: "La factura se creó pero no se pudo enviar. Puedes reenviarla desde Facturas.",
  errEmailRequired: "Indica un email para enviar la factura.",
  errInvalidEmail: "Indica un email válido.",
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function pdfUrlFor(invoice: InvoiceRow): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  return `${base}/api/invoices/${invoice.id}/pdf?token=${invoice.access_token}`;
}

/** Whether an invoice already exists for this booking — invoice-on-payment-trigger's one-invoice-per-booking gate. */
export const checkExistingInvoiceForBooking = authedAction(
  async (session, bookingId: string): Promise<InvoiceRow | null> => {
    const business = await getBusinessForUser(session.user.id);
    if (!business) return null;
    return getInvoiceForBooking(business.id, bookingId);
  }
);

export type CreateAndSendInvoiceResult =
  | { ok: true; invoice: InvoiceRow }
  | { ok: false; error: string; invoice?: InvoiceRow };

/**
 * send-invoice-action's create-and-email primitive — the only invoice
 * creation entry point (invoice-on-payment-trigger), called right after a
 * successful Cobrar (either immediately, if auto-invoice is on, or after
 * the clinic confirms "Sí"). alternateEmail: the one-off override
 * (invoice-on-payment-trigger's "¿Enviar a otro email?" field) — used only
 * for this send, never saved to the client's profile, unlike
 * saveMissingEmail below.
 */
export const createAndSendInvoice = authedAction(
  async (
    session,
    // `alternateEmail` serves BOTH the missing-email case (no email on
    // file at all — this gets saved to the client's profile, saveToProfile
    // true) and the pure one-off override case (client already has an
    // email, clinic wants to send elsewhere just this once — saveToProfile
    // false/omitted, profile untouched). See invoice-on-payment-trigger's
    // two distinctly-named notes for why these are deliberately different
    // behaviors sharing one field.
    //
    // `sendEmail` (default true): invoice-generation-without-send — the
    // "Enviar factura al cliente" checkbox in the confirm modal, default
    // checked. Checked + no resolvable email -> errEmailRequired (same as
    // before). Unchecked -> invoice is generated but never emailed, no
    // email required at all. The auto-invoice trigger passes this as
    // whether the client has a real email on file, so it silently skips
    // sending (never errors) when there's none.
    input: { bookingId: string; sendEmail?: boolean; alternateEmail?: string; saveToProfile?: boolean },
    dict?: Partial<InvoiceActionDict>
  ): Promise<CreateAndSendInvoiceResult> => {
    const t = { ...FALLBACK, ...dict };
    const sendEmail = input.sendEmail ?? true;

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    if (input.alternateEmail !== undefined && input.alternateEmail.trim() && !isValidEmail(input.alternateEmail.trim())) {
      return { ok: false, error: t.errInvalidEmail };
    }

    const created = await createInvoiceForBooking({ business, bookingId: input.bookingId });
    if (!created.ok) {
      const error =
        created.error === "no_booking" ? t.errNoBooking : created.error === "already_invoiced" ? t.errAlreadyInvoiced : t.errCreateFailed;
      return { ok: false, error };
    }

    if (!sendEmail) {
      revalidatePath("/panel/calendar");
      revalidatePath("/panel/invoices");
      return { ok: true, invoice: created.invoice };
    }

    const sendTo = input.alternateEmail?.trim() || created.invoice.client_email;
    if (!sendTo) return { ok: false, error: t.errEmailRequired, invoice: created.invoice };

    if (input.saveToProfile && input.alternateEmail?.trim()) {
      const supabase = await createClient();
      await supabase.from("kalendar_invoices").update({ client_email: sendTo }).eq("id", created.invoice.id);
      const { data: booking } = await supabase
        .from("kalendar_bookings")
        .select("clinic_client_id")
        .eq("id", input.bookingId)
        .maybeSingle();
      if (booking?.clinic_client_id) {
        await supabase.from("kalendar_clients").update({ email: sendTo }).eq("id", booking.clinic_client_id);
      }
    }

    const sendResult = await sendInvoiceEmail(created.invoice, business.id, sendTo, business.name, business.brand_color);
    if (!sendResult.ok) return { ok: false, error: t.errSendFailed, invoice: created.invoice };

    revalidatePath("/panel/calendar");
    revalidatePath("/panel/invoices");
    return { ok: true, invoice: sendResult.invoice };
  }
);

export type ResendInvoiceResult = { ok: true } | { ok: false; error: string };

/**
 * facturas-page's "Reenviar" — re-sends an EXISTING invoice, never
 * allocates a new number or creates a new row. Shares the missing-email
 * and alternate-email mechanisms with createAndSendInvoice (see
 * sendInvoiceEmail below) — one implementation, not two.
 */
export const resendInvoice = authedAction(
  async (
    session,
    input: { invoiceId: string; alternateEmail?: string; saveToProfile?: boolean },
    dict?: Partial<InvoiceActionDict>
  ): Promise<ResendInvoiceResult> => {
    const t = { ...FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    if (input.alternateEmail !== undefined && input.alternateEmail.trim() && !isValidEmail(input.alternateEmail.trim())) {
      return { ok: false, error: t.errInvalidEmail };
    }

    const supabase = await createClient();
    const { data: invoice } = await supabase
      .from("kalendar_invoices")
      .select("id, business_id, booking_id, invoice_number, issue_year, client_name, client_email, service_name, payment_method, amount, access_token, sent_at, created_at")
      .eq("id", input.invoiceId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!invoice) return { ok: false, error: t.errNoBooking };

    const sendTo = input.alternateEmail?.trim() || invoice.client_email;
    if (!sendTo) return { ok: false, error: t.errEmailRequired };

    // Missing-email save: entered email updates the invoice row's own
    // client_email AND (when linked) the client's profile — per
    // facturas-page's shared missing-email-handling note. The
    // alternate-email override (saveToProfile not set) never writes
    // back anywhere, per Arun's explicit "one-time override only" decision.
    if (input.saveToProfile && input.alternateEmail?.trim()) {
      const email = input.alternateEmail.trim();
      await supabase.from("kalendar_invoices").update({ client_email: email }).eq("id", invoice.id);
      if (invoice.booking_id) {
        const { data: booking } = await supabase
          .from("kalendar_bookings")
          .select("clinic_client_id")
          .eq("id", invoice.booking_id)
          .maybeSingle();
        if (booking?.clinic_client_id) {
          await supabase.from("kalendar_clients").update({ email }).eq("id", booking.clinic_client_id);
        }
      }
    }

    const sendResult = await sendInvoiceEmail(invoice as InvoiceRow, business.id, sendTo, business.name, business.brand_color);
    if (!sendResult.ok) return { ok: false, error: t.errSendFailed };

    revalidatePath("/panel/invoices");
    return { ok: true };
  }
);

async function sendInvoiceEmail(
  invoice: InvoiceRow,
  businessId: string,
  to: string,
  businessName: string,
  brandColor: string | null
): Promise<{ ok: true; invoice: InvoiceRow } | { ok: false }> {
  const html = invoiceEmailHtml({
    businessName,
    invoiceNumberFormatted: formatInvoiceNumber(invoice.issue_year, invoice.invoice_number),
    pdfUrl: pdfUrlFor(invoice),
    brandColor,
  });
  const result = await sendEmail({
    to,
    subject: `${businessName} · Factura ${formatInvoiceNumber(invoice.issue_year, invoice.invoice_number)}`,
    html,
  });
  if (!result.ok) return { ok: false };

  const supabase = await createClient();
  const { data: updated } = await supabase
    .from("kalendar_invoices")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .eq("business_id", businessId)
    .select("id, business_id, booking_id, invoice_number, issue_year, client_name, client_email, service_name, payment_method, amount, access_token, sent_at, created_at")
    .single();

  return { ok: true, invoice: (updated as InvoiceRow | null) ?? invoice };
}

// ── Settings: template, auto-invoice, signature ─────────────────────────────

export type SaveInvoiceSettingResult = { ok: true } | { ok: false; error: string };

export const saveInvoiceTemplate = authedAction(
  async (session, templateId: string, dict?: { errNoBusiness: string; errSaveFailed: string }): Promise<SaveInvoiceSettingResult> => {
    const t = { errNoBusiness: dict?.errNoBusiness ?? FALLBACK.errNoBusiness, errSaveFailed: dict?.errSaveFailed ?? "No se pudo guardar." };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };
    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_businesses")
      .update({ invoice_template_id: templateId })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);
    if (error) return { ok: false, error: t.errSaveFailed };
    revalidatePath("/panel/settings/invoicing");
    return { ok: true };
  }
);

export const saveAutoInvoiceSetting = authedAction(
  async (session, enabled: boolean, dict?: { errNoBusiness: string; errSaveFailed: string }): Promise<SaveInvoiceSettingResult> => {
    const t = { errNoBusiness: dict?.errNoBusiness ?? FALLBACK.errNoBusiness, errSaveFailed: dict?.errSaveFailed ?? "No se pudo guardar." };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };
    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_businesses")
      .update({ auto_invoice_enabled: enabled })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);
    if (error) return { ok: false, error: t.errSaveFailed };
    revalidatePath("/panel/settings/invoicing");
    return { ok: true };
  }
);

const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;
const SIGNATURE_ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type UploadSignatureResult = { ok: true; signatureUrl: string } | { ok: false; error: string };

export const uploadInvoiceSignature = authedAction(
  async (session, formData: FormData, dict?: { errNoBusiness: string; errInvalidFile: string; errSaveFailed: string }): Promise<UploadSignatureResult> => {
    const t = {
      errNoBusiness: dict?.errNoBusiness ?? FALLBACK.errNoBusiness,
      errInvalidFile: dict?.errInvalidFile ?? "Sube una imagen PNG, JPG o WEBP de hasta 2MB.",
      errSaveFailed: dict?.errSaveFailed ?? "No se pudo subir la firma.",
    };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const file = formData.get("signature");
    if (!(file instanceof File) || file.size > SIGNATURE_MAX_BYTES || !SIGNATURE_ALLOWED_TYPES.has(file.type)) {
      return { ok: false, error: t.errInvalidFile };
    }

    const supabase = await createClient();
    const ext = file.name.split(".").pop() ?? "png";
    const fileName = `${business.id}/signature-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("invoice-signatures")
      .upload(fileName, file, { contentType: file.type, upsert: true });
    if (uploadError) return { ok: false, error: t.errSaveFailed };

    const { data: publicUrlData } = supabase.storage.from("invoice-signatures").getPublicUrl(fileName);
    const signatureUrl = publicUrlData.publicUrl;

    const { error } = await supabase
      .from("kalendar_businesses")
      .update({ signature_url: signatureUrl })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);
    if (error) return { ok: false, error: t.errSaveFailed };

    if (business.signature_url) {
      const prevPath = business.signature_url.split("/invoice-signatures/")[1];
      if (prevPath) await supabase.storage.from("invoice-signatures").remove([prevPath]);
    }

    revalidatePath("/panel/settings/invoicing");
    return { ok: true, signatureUrl };
  }
);

export const removeInvoiceSignature = authedAction(
  async (session, dict?: { errNoBusiness: string; errSaveFailed: string }): Promise<SaveInvoiceSettingResult> => {
    const t = { errNoBusiness: dict?.errNoBusiness ?? FALLBACK.errNoBusiness, errSaveFailed: dict?.errSaveFailed ?? "No se pudo guardar el cambio." };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_businesses")
      .update({ signature_url: null })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);
    if (error) return { ok: false, error: t.errSaveFailed };

    if (business.signature_url) {
      const prevPath = business.signature_url.split("/invoice-signatures/")[1];
      if (prevPath) await supabase.storage.from("invoice-signatures").remove([prevPath]);
    }

    revalidatePath("/panel/settings/invoicing");
    return { ok: true };
  }
);

export const saveNextInvoiceNumber = authedAction(
  async (
    session,
    // null clears the override (back to the natural sequence); a number
    // sets next-invoice-number-override's one-shot floor for this business.
    value: number | null,
    dict?: { errNoBusiness: string; errInvalid: string; errSaveFailed: string }
  ): Promise<SaveInvoiceSettingResult> => {
    const t = {
      errNoBusiness: dict?.errNoBusiness ?? FALLBACK.errNoBusiness,
      errInvalid: dict?.errInvalid ?? "Indica un número de factura válido.",
      errSaveFailed: dict?.errSaveFailed ?? "No se pudo guardar.",
    };
    if (value !== null && (!Number.isInteger(value) || value < 1)) {
      return { ok: false, error: t.errInvalid };
    }
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };
    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_businesses")
      .update({ invoice_next_number: value })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);
    if (error) return { ok: false, error: t.errSaveFailed };
    revalidatePath("/panel/settings/invoicing");
    return { ok: true };
  }
);

export const saveProfessionalIdFields = authedAction(
  async (
    session,
    input: { professionalDni: string; professionalCollegeNumber: string },
    dict?: { errNoBusiness: string; errSaveFailed: string }
  ): Promise<SaveInvoiceSettingResult> => {
    const t = { errNoBusiness: dict?.errNoBusiness ?? FALLBACK.errNoBusiness, errSaveFailed: dict?.errSaveFailed ?? "No se pudo guardar." };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };
    const supabase = await createClient();
    const { error } = await supabase
      .from("kalendar_businesses")
      .update({
        professional_dni: input.professionalDni.trim() || null,
        professional_college_number: input.professionalCollegeNumber.trim() || null,
      })
      .eq("id", business.id)
      .eq("owner_id", session.user.id);
    if (error) return { ok: false, error: t.errSaveFailed };
    revalidatePath("/panel/business");
    return { ok: true };
  }
);
