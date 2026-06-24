import { DAYS } from "./data";
import type { OnboardingData } from "./types";

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Returns true when the user can proceed from the given step. */
export function canProceed(step: number, d: OnboardingData): boolean {
  switch (step) {
    case 0:
      // Step 0: user must have authenticated via Google OR email+password
      return d.account.googleAuthed || d.account.emailAuthed;
    case 1:
      return d.business.name.trim().length > 0 && !!d.business.type;
    case 2:
      return d.services.length >= 1 && d.services.every((s) => s.name.trim().length > 0);
    case 3:
      return DAYS.some((day) => d.schedule[day.id].on);
    case 4:
      return d.team.length >= 1 && d.team[0].name.trim().length > 0;
    default:
      return true;
  }
}
