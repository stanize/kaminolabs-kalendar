"use server";

import { cookies } from "next/headers";
import { CALENDAR_PROVIDER_FILTER_COOKIE } from "@/lib/calendar/provider-filter";

/**
 * Persists the calendar's provider filter (multi-provider-calendar-display,
 * workflows/calendar-management-upcoming.md) — empty array clears it back
 * to "all". No auth check: a pure per-browser UI preference, same shape as
 * lib/actions/locale.ts's language cookie; the actual booking queries stay
 * scoped by business_id regardless of what this cookie holds.
 */
export async function setCalendarProviderFilter(memberIds: string[]): Promise<void> {
  const store = await cookies();
  if (memberIds.length === 0) {
    store.delete(CALENDAR_PROVIDER_FILTER_COOKIE);
    return;
  }
  store.set(CALENDAR_PROVIDER_FILTER_COOKIE, memberIds.join(","), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
