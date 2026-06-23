import { DIAS } from "./data";
import type { OnboardingData } from "./types";

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Mirrors the `canNext` array from the design handoff, one rule per config step (0-4). */
export function canAdvance(paso: number, d: OnboardingData): boolean {
  switch (paso) {
    case 0: {
      const emailOk = EMAIL_RE.test(d.account.email.trim());
      return (
        d.account.googleAuthed ||
        (d.account.nombre.trim().length > 1 && emailOk && d.account.password.length >= 6)
      );
    }
    case 1:
      return d.negocio.nombre.trim().length > 0 && !!d.negocio.tipo;
    case 2:
      return d.servicios.length >= 1 && d.servicios.every((s) => s.nombre.trim().length > 0);
    case 3:
      return DIAS.some((dia) => d.horario[dia.id].on);
    case 4:
      return d.equipo.length >= 1 && d.equipo[0].nombre.trim().length > 0;
    default:
      return true;
  }
}
