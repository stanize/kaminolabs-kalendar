import "server-only";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { resolveClinicClientId } from "@/lib/booking/client-link";
import type { Business } from "@/lib/business/data";
import type { InvoiceBusinessSnapshot, InvoiceRow } from "@/lib/invoices/types";

export type { InvoiceRow } from "@/lib/invoices/types";
export { formatInvoiceNumber } from "@/lib/invoices/types";

const INVOICE_COLUMNS =
  "id, business_id, booking_id, invoice_number, issue_year, client_name, client_email, client_dni, client_address, service_name, payment_method, amount, access_token, sent_at, created_at, business_snapshot";

/**
 * business-fields-snapshot: freezes everything the PDF template reads, at
 * invoice-creation time. provider-invoicing-fields (2026-10): the DNI/
 * colegiada number/"Fdo:" name come from the booking's ASSIGNED team
 * member, not the business — a multi-provider clinic can have a different
 * one per person. `provider` is null when the booking has no
 * team_member_id (shouldn't happen in practice — every booking gets one,
 * solo included, see lib/actions/booking.ts — but handled defensively),
 * in which case these three fields fall back to blank/the business name.
 */
function buildBusinessSnapshot(
  business: Business,
  provider: { name: string; professional_dni: string | null; professional_college_number: string | null } | null
): InvoiceBusinessSnapshot {
  return {
    name: business.name,
    legalId: business.legal_id,
    addressStreet: business.address_street,
    addressNumber: business.address_number,
    addressAdditional: business.address_additional,
    city: business.city,
    addressPostalCode: business.address_postal_code,
    addressProvince: business.address_province,
    addressCountry: business.address_country,
    contactEmail: business.contact_email,
    phoneCountryCode: business.phone_country_code,
    phoneNumber: business.phone_number,
    professionalDni: provider?.professional_dni ?? null,
    professionalCollegeNumber: provider?.professional_college_number ?? null,
    professionalName: provider?.name ?? business.name,
    signatureUrl: business.signature_url,
    templateId: business.invoice_template_id,
    brandColor: business.brand_color,
    isSolo: business.team_mode === "solo",
  };
}

/** Coalesces legacy rows (client_dni/client_address added later, nullable
 * on the live table — see schema_subset_028.sql) to "" so InvoiceRow's
 * non-null string type holds for every row regardless of when it was
 * created. */
function normalizeInvoiceRow(row: InvoiceRow): InvoiceRow {
  return { ...row, client_dni: row.client_dni ?? "", client_address: row.client_address ?? "" };
}

/**
 * The invoice already created for a given booking, if any — used by
 * invoice-on-payment-trigger's one-invoice-per-booking rule (never prompt
 * or auto-generate a second one for the same booking).
 */
export async function getInvoiceForBooking(businessId: string, bookingId: string): Promise<InvoiceRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_invoices")
    .select(INVOICE_COLUMNS)
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .maybeSingle();
  return data ? normalizeInvoiceRow(data as InvoiceRow) : null;
}

export async function getInvoiceById(id: string): Promise<InvoiceRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("kalendar_invoices").select(INVOICE_COLUMNS).eq("id", id).maybeSingle();
  return data ? normalizeInvoiceRow(data as InvoiceRow) : null;
}

export async function getInvoicesForBusiness(businessId: string): Promise<InvoiceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_invoices")
    .select(INVOICE_COLUMNS)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return ((data as InvoiceRow[] | null) ?? []).map(normalizeInvoiceRow);
}

/**
 * Read-only prediction of the number the NEXT invoice generated this year
 * would get — next-invoice-number-override's settings-page preview. Mirrors
 * allocate_invoice_number's logic without consuming the override or
 * allocating anything, so it's safe to call on every settings page render.
 */
export async function getNextInvoiceNumberPreview(
  businessId: string,
  issueYear: number,
  overrideNumber: number | null
): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_invoices")
    .select("invoice_number")
    .eq("business_id", businessId)
    .eq("issue_year", issueYear)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const natural = (data ? parseInt(data.invoice_number, 10) : 0) + 1;
  const next = overrideNumber && overrideNumber > natural ? overrideNumber : natural;
  return String(next).padStart(4, "0");
}

export interface CreateInvoiceInput {
  business: Business;
  bookingId: string;
  // client-identity-for-invoicing: entered/corrected in the invoice confirm
  // modal. Falls back to the client's existing dni/address on file when
  // left blank; if NEITHER is available, creation fails with
  // "missing_identity" — the caller (lib/actions/invoices.ts) owns
  // surfacing that as a required-field error.
  clientDni?: string;
  clientAddress?: string;
}

export type CreateInvoiceResult =
  | { ok: true; invoice: InvoiceRow }
  | { ok: false; error: "no_booking" | "already_invoiced" | "create_failed" | "missing_identity" };

/**
 * Creates the kalendar_invoices row for a booking — allocates the
 * sequential number (sequential-numbering-allocation, via the
 * allocate_invoice_number Postgres function) and snapshots the booking's
 * current client/service/payment data. Does NOT render or send anything —
 * that's send-invoice-action/the caller's job.
 *
 * Backfills a missing clinic_client_id (invoice-on-payment-trigger's
 * resolved "generate a dummy one" decision — not actually a placeholder,
 * a real kalendar_clients row built from the booking's own data, reusing
 * client-linking-on-booking's resolveClinicClientId rather than a second
 * creation path) and updates the booking to point at it.
 */
export async function createInvoiceForBooking(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const supabase = await createClient();
  const businessId = input.business.id;

  const { data: booking } = await supabase
    .from("kalendar_bookings")
    .select(
      "id, business_id, clinic_client_id, patient_id, team_member_id, client_name, client_email, client_phone, service_name, service_price, payment_method"
    )
    .eq("id", input.bookingId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!booking) return { ok: false, error: "no_booking" };

  let provider: { name: string; professional_dni: string | null; professional_college_number: string | null } | null = null;
  if (booking.team_member_id) {
    const { data: member } = await supabase
      .from("kalendar_team_members")
      .select("name, professional_dni, professional_college_number")
      .eq("id", booking.team_member_id)
      .eq("business_id", businessId)
      .maybeSingle();
    provider = member ?? null;
  }

  const existing = await getInvoiceForBooking(businessId, input.bookingId);
  if (existing) return { ok: false, error: "already_invoiced" };

  let clinicClientId = booking.clinic_client_id as string | null;
  if (!clinicClientId) {
    clinicClientId = await resolveClinicClientId({
      businessId,
      patientId: booking.patient_id,
      name: booking.client_name,
      email: booking.client_email,
      phone: booking.client_phone,
    });
    if (clinicClientId) {
      await supabase.from("kalendar_bookings").update({ clinic_client_id: clinicClientId }).eq("id", booking.id);
    }
  }

  // client-identity-for-invoicing: resolve the final dni/address — the
  // modal's input (if any) wins, falling back to whatever's already on the
  // client's profile. Required either way; missing either one fails the
  // whole creation rather than writing a legally incomplete invoice.
  let existingDni: string | null = null;
  let existingAddress: string | null = null;
  if (clinicClientId) {
    const { data: clientRow } = await supabase
      .from("kalendar_clients")
      .select("dni, address")
      .eq("id", clinicClientId)
      .maybeSingle();
    existingDni = clientRow?.dni ?? null;
    existingAddress = clientRow?.address ?? null;
  }
  const finalDni = input.clientDni?.trim() || existingDni || "";
  const finalAddress = input.clientAddress?.trim() || existingAddress || "";
  if (!finalDni || !finalAddress) return { ok: false, error: "missing_identity" };

  if (clinicClientId && (finalDni !== existingDni || finalAddress !== existingAddress)) {
    await supabase.from("kalendar_clients").update({ dni: finalDni, address: finalAddress }).eq("id", clinicClientId);
  }

  const issueYear = new Date().getFullYear();
  const { data: numberData, error: numberError } = await supabase.rpc("allocate_invoice_number", {
    p_business_id: businessId,
    p_issue_year: issueYear,
  });
  if (numberError || !numberData) return { ok: false, error: "create_failed" };

  const accessToken = randomBytes(24).toString("base64url");

  const { data: created, error } = await supabase
    .from("kalendar_invoices")
    .insert({
      business_id: businessId,
      booking_id: booking.id,
      invoice_number: numberData,
      issue_year: issueYear,
      client_name: booking.client_name,
      client_email: booking.client_email,
      client_dni: finalDni,
      client_address: finalAddress,
      service_name: booking.service_name,
      payment_method: booking.payment_method,
      amount: booking.service_price,
      access_token: accessToken,
      business_snapshot: buildBusinessSnapshot(input.business, provider),
    })
    .select(INVOICE_COLUMNS)
    .single();

  if (error || !created) return { ok: false, error: "create_failed" };
  return { ok: true, invoice: normalizeInvoiceRow(created as InvoiceRow) };
}
