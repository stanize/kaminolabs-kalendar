import { NextResponse } from "next/server";
import { getAvailableSlots, submitBooking } from "@/lib/actions/booking";

/**
 * Internal endpoint used ONLY by the admin portal's appointment-generator
 * tool. Wraps the exact same functions the real public booking wizard uses
 * (getAvailableSlots, submitBooking) — this is the whole point: generated
 * test appointments go through real slot-availability checks, the real
 * double-booking unique-index guard, and real notification emails, so they
 * are indistinguishable from production traffic to every downstream system
 * (reminders, expiry sweep, panel views).
 *
 * Shared-secret protected via INTERNAL_APPOINTMENT_GEN_SECRET — deliberately
 * a DIFFERENT secret from INTERNAL_SCHEMA_API_SECRET. That one only reads
 * file text; this one creates real rows and sends real emails, so it gets
 * its own narrower-blast-radius credential.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_APPOINTMENT_GEN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "slots") {
    const result = await getAvailableSlots({
      slug: body.slug,
      serviceId: body.serviceId,
      providerId: body.providerId ?? null,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    });
    return NextResponse.json(result);
  }

  if (body.action === "create") {
    const result = await submitBooking({
      slug: body.slug,
      serviceId: body.serviceId,
      providerId: body.providerId ?? null,
      startIso: body.startIso,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      clientPhone: body.clientPhone ?? "",
      notes: body.notes,
      guestLocale: body.guestLocale ?? "es",
      patientId: body.patientId ?? null,
      statusOverride: body.statusOverride,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
