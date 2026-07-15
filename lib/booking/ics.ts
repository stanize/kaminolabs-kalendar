/**
 * Minimal iCalendar (.ics) generator for a single booking event — attached to
 * confirmation emails so the client can add the appointment to their
 * calendar with one tap. No external dependency; the format needed here is
 * small enough to hand-roll safely.
 */
export interface IcsEventInput {
  uid: string; // stable per-booking id, e.g. the booking token
  summary: string; // event title, e.g. "Limpieza facial · Clinic Tercero"
  description?: string;
  location?: string;
  startIso: string;
  durationMin: number;
}

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Returns the raw .ics file content (CRLF line endings, per RFC 5545). */
export function buildBookingIcs(input: IcsEventInput): string {
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + input.durationMin * 60_000);
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kalendar//Booking//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@kalendar.kaminolabs.dev`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${icsEscape(input.summary)}`,
    input.location ? `LOCATION:${icsEscape(input.location)}` : "",
    input.description ? `DESCRIPTION:${icsEscape(input.description)}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

/** Base64-encodes the .ics content, ready for the Resend attachments field. */
export function buildBookingIcsBase64(input: IcsEventInput): string {
  return Buffer.from(buildBookingIcs(input), "utf-8").toString("base64");
}
