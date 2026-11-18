"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import {
  createInvoiceForBooking,
  getInvoiceById,
  getInvoiceForBooking,
  getProviderForBooking,
  buildBusinessSnapshot,
  formatInvoiceNumber,
  type InvoiceRow,
} from "@/lib/invoices/data";
import { sendEmail, invoiceEmailHtml } from "@/lib/email";
import {
  getInvoiceConcepts,
  findOrCreateInvoiceConcept,
  renameInvoiceConcept,
  deleteInvoiceConcept,
  type InvoiceConcept,
} from "@/lib/invoices/concepts";

export interface InvoiceActionDict {
  errNoBusiness: string;
  errNoBooking: string;
  errAlreadyInvoiced: string;
  errCreateFailed: string;
  errSendFailed: string;
  errEmailRequired: string;
  errInvalidEmail: string;
  errClientIdentityRequired: string;
  errNameRequired: string;
  errAmountInvalid: string;
  errNoteTooLong: string;
}

const FALLBACK: InvoiceActionDict = {
  errNoBusiness: "No hay negocio.",
  errNoBooking: "Reserva no encontrada.",
  errAlreadyInvoiced: "Esta cita ya tiene una factura.",
  errCreateFailed: "No se pudo crear la factura.",
  errSendFailed: "La factura se creó pero no se pudo enviar. Puedes reenviarla desde Facturas.",
  errEmailRequired: "Indica un email para enviar la factura.",
  errInvalidEmail: "Indica un email válido.",
  errClientIdentityRequired: "Indica el DNI y el domicilio del cliente.",
  errNameRequired: "Indica el nombre del cliente.",
  errAmountInvalid: "Indica un importe válido.",
  errNoteTooLong: "Las observaciones no pueden superar los 300 caracteres.",
};

const NOTE_MAX = 300;
const NAME_MAX = 120;
const AMOUNT_MAX = 99999.99;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function pdfUrlFor(invoice: InvoiceRow): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  return `${base}/api/invoices/${invoice.id}/pdf?token=${invoice.access_token}`;
}

/**
 * invoice-edit-before-generate: the appointment's own client name and service
 * price, which pre-fill the generate-invoice panel's editable fields. Scoped
 * to the caller's business.
 */
export const getInvoiceBookingDefaults = authedAction(
  async (session, bookingId: string): Promise<{ clientName: string; servicePrice: number } | null> => {
    const business = await getBusinessForUser(session.user.id);
    if (!business) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("kalendar_bookings")
      .select("client_name, service_price")
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .maybeSingle();
    return data ? { clientName: data.client_name as string, servicePrice: Number(data.service_price) } : null;
  }
);

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
    input: {
      bookingId: string;
      sendEmail?: boolean;
      alternateEmail?: string;
      saveToProfile?: boolean;
      // client-identity-for-invoicing: entered/corrected in the confirm
      // modal, falls back to the client's existing profile values —
      // createInvoiceForBooking does the actual required-either-way check.
      clientDni?: string;
      clientAddress?: string;
      // invoice-concepts-list: `concept` is the full invoice service_name
      // override (service name + optional extra line already joined by
      // the modal). `extraConcept`, when present, is just the extra line
      // on its own — the thing that gets auto-added to the business's
      // concepts list (never the combined string, which always starts
      // with the booking's service name).
      concept?: string;
      extraConcept?: string;
      // invoice-edit-before-generate: edited in the panel; apply to this
      // invoice only. `amount` differing from the appointment's service
      // price is recorded as an internal marker (never printed).
      clientName?: string;
      amount?: number;
      note?: string;
    },
    dict?: Partial<InvoiceActionDict>
  ): Promise<CreateAndSendInvoiceResult> => {
    const t = { ...FALLBACK, ...dict };
    const sendEmail = input.sendEmail ?? true;

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    if (input.alternateEmail !== undefined && input.alternateEmail.trim() && !isValidEmail(input.alternateEmail.trim())) {
      return { ok: false, error: t.errInvalidEmail };
    }

    if (input.clientName !== undefined && (!input.clientName.trim() || input.clientName.trim().length > NAME_MAX)) {
      return { ok: false, error: t.errNameRequired };
    }
    let amount: number | undefined;
    if (input.amount !== undefined) {
      if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount < 0 || input.amount > AMOUNT_MAX) {
        return { ok: false, error: t.errAmountInvalid };
      }
      amount = Math.round(input.amount * 100) / 100;
    }
    if (input.note !== undefined && input.note.trim().length > NOTE_MAX) {
      return { ok: false, error: t.errNoteTooLong };
    }

    const extraConcept = input.extraConcept?.trim();
    if (extraConcept) await findOrCreateInvoiceConcept(business.id, extraConcept);
    const concept = input.concept?.trim();

    const created = await createInvoiceForBooking({
      business,
      bookingId: input.bookingId,
      clientDni: input.clientDni,
      clientAddress: input.clientAddress,
      concept,
      clientName: input.clientName,
      amount,
      note: input.note,
    });
    if (!created.ok) {
      const error =
        created.error === "no_booking"
          ? t.errNoBooking
          : created.error === "already_invoiced"
            ? t.errAlreadyInvoiced
            : created.error === "missing_identity"
              ? t.errClientIdentityRequired
              : t.errCreateFailed;
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

export type RegenerateInvoiceResult = { ok: true; version: number } | { ok: false; error: string };

/**
 * invoice-regenerate (pdf-invoicing.md): "Regenerar" rebuilds an invoice with
 * the clinic's CURRENT information while keeping every earlier version.
 *
 * - SAME invoice number (and id, token, issue date). The invoice row is
 *   always the current version; its previous state is copied into
 *   kalendar_invoice_versions first, so nothing is ever deleted.
 * - Refreshed from current data: business details, the booking's
 *   practitioner (name, title, colegiada, signature), the template, and the
 *   client's DNI/address from their profile.
 * - Kept as invoiced: client name/email, service/concept, note, amount,
 *   payment method (the amount and billed name are what was issued).
 * - Does NOT email anything — the clinic uses "Reenviar" for that.
 *
 * FUTURE (Arun): once VeriFactu is implemented, an invoice that has been
 * officially submitted must NOT be regenerable. That rule belongs right here,
 * as one explicit check before any write.
 */
export const regenerateInvoice = authedAction(
  async (
    session,
    invoiceId: string,
    dict?: { errNoBusiness: string; errNotFound: string; errFailed: string }
  ): Promise<RegenerateInvoiceResult> => {
    const t = {
      errNoBusiness: dict?.errNoBusiness ?? FALLBACK.errNoBusiness,
      errNotFound: dict?.errNotFound ?? "Factura no encontrada.",
      errFailed: dict?.errFailed ?? "No se pudo regenerar la factura.",
    };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice || invoice.business_id !== business.id) return { ok: false, error: t.errNotFound };

    const supabase = await createClient();

    // Current data. The booking gives the practitioner and the client link;
    // if the booking is gone, the invoice's own frozen practitioner/client
    // details are kept (only the business-level part is refreshed).
    let provider = null;
    let clientRow: { dni: string | null; address: string | null } | null = null;
    if (invoice.booking_id) {
      const { data: booking } = await supabase
        .from("kalendar_bookings")
        .select("team_member_id, clinic_client_id")
        .eq("id", invoice.booking_id)
        .eq("business_id", business.id)
        .maybeSingle();
      if (booking) {
        provider = await getProviderForBooking(business.id, booking.team_member_id as string | null);
        if (booking.clinic_client_id) {
          const { data } = await supabase
            .from("kalendar_clients")
            .select("dni, address")
            .eq("id", booking.clinic_client_id)
            .maybeSingle();
          clientRow = data ?? null;
        }
      }
    }

    const fresh = buildBusinessSnapshot(business, provider);
    if (!provider) {
      const old = invoice.business_snapshot;
      fresh.professionalDni = old.professionalDni;
      fresh.professionalCollegeNumber = old.professionalCollegeNumber;
      fresh.professionalTitle = old.professionalTitle;
      fresh.professionalName = old.professionalName;
      fresh.signatureUrl = old.signatureUrl;
    }
    const newDni = clientRow?.dni?.trim() || invoice.client_dni;
    const newAddress = clientRow?.address?.trim() || invoice.client_address;

    // 1) Archive the version being replaced. The unique (invoice_id, version)
    //    also stops a double-click from archiving it twice.
    const { error: archiveError } = await supabase.from("kalendar_invoice_versions").insert({
      invoice_id: invoice.id,
      business_id: business.id,
      version: invoice.version,
      client_name: invoice.client_name,
      client_email: invoice.client_email,
      client_dni: invoice.client_dni,
      client_address: invoice.client_address,
      service_name: invoice.service_name,
      payment_method: invoice.payment_method,
      amount: invoice.amount,
      original_amount: invoice.original_amount,
      amount_modified: invoice.amount_modified,
      note: invoice.note,
      business_snapshot: invoice.business_snapshot,
      verification_url: invoice.verification_url,
      issued_at: invoice.regenerated_at ?? invoice.created_at,
    });
    if (archiveError) return { ok: false, error: t.errFailed };

    // 2) Overwrite the current record, only if nobody regenerated it meanwhile.
    const nextVersion = invoice.version + 1;
    const { data: updated, error: updateError } = await supabase
      .from("kalendar_invoices")
      .update({
        business_snapshot: fresh,
        client_dni: newDni,
        client_address: newAddress,
        version: nextVersion,
        regenerated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id)
      .eq("business_id", business.id)
      .eq("version", invoice.version)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      // Undo the archive so a retry starts clean.
      await supabase
        .from("kalendar_invoice_versions")
        .delete()
        .eq("invoice_id", invoice.id)
        .eq("version", invoice.version);
      return { ok: false, error: t.errFailed };
    }

    revalidatePath("/panel/invoices");
    return { ok: true, version: nextVersion };
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

// ── Settings: invoice concepts list ──────────────────────────────────────

/** invoice-concepts-list: used by the confirm modal's datalist (no dict needed — read-only). */
export const listInvoiceConcepts = authedAction(async (session): Promise<InvoiceConcept[]> => {
  const business = await getBusinessForUser(session.user.id);
  if (!business) return [];
  return getInvoiceConcepts(business.id);
});

export type SaveInvoiceConceptResult = { ok: true; concept: InvoiceConcept } | { ok: false; error: string };

export const addInvoiceConcept = authedAction(
  async (session, label: string, dict?: { errNoBusiness: string; errSaveFailed: string }): Promise<SaveInvoiceConceptResult> => {
    const t = { errNoBusiness: dict?.errNoBusiness ?? FALLBACK.errNoBusiness, errSaveFailed: dict?.errSaveFailed ?? "No se pudo guardar." };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };
    const concept = await findOrCreateInvoiceConcept(business.id, label);
    if (!concept) return { ok: false, error: t.errSaveFailed };
    revalidatePath("/panel/settings/invoicing");
    return { ok: true, concept };
  }
);

export const updateInvoiceConcept = authedAction(
  async (
    session,
    input: { conceptId: string; label: string },
    dict?: { errNoBusiness: string; errSaveFailed: string }
  ): Promise<SaveInvoiceConceptResult> => {
    const t = { errNoBusiness: dict?.errNoBusiness ?? FALLBACK.errNoBusiness, errSaveFailed: dict?.errSaveFailed ?? "No se pudo guardar." };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };
    const concept = await renameInvoiceConcept(business.id, input.conceptId, input.label);
    if (!concept) return { ok: false, error: t.errSaveFailed };
    revalidatePath("/panel/settings/invoicing");
    return { ok: true, concept };
  }
);

export const removeInvoiceConcept = authedAction(
  async (session, conceptId: string, dict?: { errNoBusiness: string; errSaveFailed: string }): Promise<SaveInvoiceSettingResult> => {
    const t = { errNoBusiness: dict?.errNoBusiness ?? FALLBACK.errNoBusiness, errSaveFailed: dict?.errSaveFailed ?? "No se pudo guardar." };
    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };
    const ok = await deleteInvoiceConcept(business.id, conceptId);
    if (!ok) return { ok: false, error: t.errSaveFailed };
    revalidatePath("/panel/settings/invoicing");
    return { ok: true };
  }
);

