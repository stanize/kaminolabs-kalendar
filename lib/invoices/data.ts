import "server-only";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { resolveClinicClientId } from "@/lib/booking/client-link";
import type { Business } from "@/lib/business/data";
import type { InvoiceBusinessSnapshot, InvoiceRow } from "@/lib/invoices/types";

export type { InvoiceRow } from "@/lib/invoices/types";
export { formatInvoiceNumber } from "@/lib/invoices/types";

const INVOICE_COLUMNS =
  "id, business_id, booking_id, invoice_number, issue_year, client_name, client_email, service_name, payment_method, amount, access_token, sent_at, created_at, business_snapshot";

/** business-fields-snapshot: freezes everything the PDF template reads off the business, at invoice-creation time. */
function buildBusinessSnapshot(business: Business): InvoiceBusinessSnapshot {
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
    professionalDni: business.professional_dni,
    professionalCollegeNumber: business.professional_college_number,
    professionalName: business.professional_name,
    signatureUrl: business.signature_url,
    templateId: business.invoice_template_id,
    brandColor: business.brand_color,
  };
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
  return (data as InvoiceRow | null) ?? null;
}

export async function getInvoiceById(id: string): Promise<InvoiceRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("kalendar_invoices").select(INVOICE_COLUMNS).eq("id", id).maybeSingle();
  return (data as InvoiceRow | null) ?? null;
}

export async function getInvoicesForBusiness(businessId: string): Promise<InvoiceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kalendar_invoices")
    .select(INVOICE_COLUMNS)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return (data as InvoiceRow[] | null) ?? [];
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
}

export type CreateInvoiceResult =
  | { ok: true; invoice: InvoiceRow }
  | { ok: false; error: "no_booking" | "already_invoiced" | "create_failed" };

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
    .select("id, business_id, clinic_client_id, patient_id, client_name, client_email, client_phone, service_name, service_price, payment_method")
    .eq("id", input.bookingId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!booking) return { ok: false, error: "no_booking" };

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
      service_name: booking.service_name,
      payment_method: booking.payment_method,
      amount: booking.service_price,
      access_token: accessToken,
      business_snapshot: buildBusinessSnapshot(input.business),
    })
    .select(INVOICE_COLUMNS)
    .single();

  if (error || !created) return { ok: false, error: "create_failed" };
  return { ok: true, invoice: created as InvoiceRow };
}
