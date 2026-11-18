// custom-time-slots, "Frecuencia" type (workflows/custom-time-slots.md,
// slot-type-frequency). Client-safe (no "server-only") — shared by the
// rule editor's live preview and by lib/actions/custom-slots.ts, so the
// preview a clinic sees is exactly what gets saved.

export type SlotType = "custom" | "frequency";

/** Minutes between offered start times, as selectable in the editor. */
export const FREQUENCY_OPTIONS = [5, 10, 15, 20, 30, 45, 60] as const;

const TIME_RE = /^(\d{2}):(\d{2})$/;

function toMinutes(hhmm: string): number | null {
  const m = TIME_RE.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Every start time from `start` up to (but NOT including) `end`, stepping by
 * `frequencyMin` — e.g. 09:00 to 13:00 every 30 min gives 09:00, 09:30, …,
 * 12:30. The end time is exclusive on purpose: nobody starts an appointment
 * at closing time, and it matches how Horarios' own ranges behave.
 * Returns null when the inputs aren't usable (bad time, end not after start,
 * non-positive frequency).
 */
export function generateFrequencyTimes(
  start: string,
  end: string,
  frequencyMin: number
): string[] | null {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null || e <= s) return null;
  if (!Number.isInteger(frequencyMin) || frequencyMin <= 0) return null;
  const out: string[] = [];
  for (let t = s; t < e; t += frequencyMin) out.push(fromMinutes(t));
  return out;
}
