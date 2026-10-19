import "server-only";
import { cookies } from "next/headers";

/**
 * multi-provider-calendar-display (workflows/calendar-management-upcoming.md):
 * the persistent, multi-select provider filter shared by the calendar's
 * Day/Week view. Empty array = "all providers" (the default) — nothing
 * ever needs to write every member id in to mean "all".
 */
export const CALENDAR_PROVIDER_FILTER_COOKIE = "kalendar_calendar_providers";

export async function getCalendarProviderFilter(): Promise<string[]> {
  const store = await cookies();
  const value = store.get(CALENDAR_PROVIDER_FILTER_COOKIE)?.value;
  if (!value) return [];
  return value.split(",").filter(Boolean);
}
