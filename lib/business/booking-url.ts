/**
 * Single source of truth for the public booking URL shape.
 *
 * Public booking pages live under the /bookings/ namespace so a business slug
 * can never collide with an application route (/panel, /login, /api, ...).
 *
 * The displayed URL is the full real one the user shares, e.g.
 *   https://kalendar.kaminolabs.dev/bookings/centro-bienestar
 * Every place that builds a booking link must call these helpers rather than
 * hardcoding the domain or the /bookings segment, so the project ports cleanly
 * (change the domain via NEXT_PUBLIC_APP_URL, change the segment here, once).
 */

/** Root path segment under which all public booking pages are served. */
export const BOOKING_PATH_SEGMENT = "bookings";

/** Internal Next.js path for <Link href>, e.g. "/bookings/centro-bienestar". */
export function bookingPath(slug: string): string {
  return `/${BOOKING_PATH_SEGMENT}/${slug}`;
}

/**
 * Full shareable URL, e.g. "https://kalendar.kaminolabs.dev/bookings/centro-bienestar".
 * Falls back to a relative path if NEXT_PUBLIC_APP_URL is unset.
 */
export function bookingUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  return `${base}${bookingPath(slug)}`;
}

/**
 * Display form of the booking URL with the scheme stripped, for compact UI,
 * e.g. "kalendar.kaminolabs.dev/bookings/centro-bienestar".
 */
export function bookingUrlDisplay(slug: string): string {
  return bookingUrl(slug).replace(/^https?:\/\//, "");
}
