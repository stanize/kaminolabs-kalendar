export type TipoNegocio =
  | "psico"
  | "nutri"
  | "fisio"
  | "belleza"
  | "fitness"
  | "coaching"
  | "tutorias"
  | "otro";

export type DiaId = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";

export interface Servicio {
  id: string;
  nombre: string;
  min: number;
  precio: number;
}

export interface DiaHorario {
  on: boolean;
  desde: string;
  hasta: string;
}

export type Horario = Record<DiaId, DiaHorario>;

export interface MiembroEquipo {
  nombre: string;
  rol: string;
  owner: boolean;
}

export interface OnboardingAccount {
  nombre: string;
  email: string;
  password: string;
  /** true once the person has authenticated via Google OAuth */
  googleAuthed: boolean;
  /** true once the person has signed up or signed in via email+password */
  emailAuthed: boolean;
}

export interface OnboardingNegocio {
  nombre: string;
  tipo: TipoNegocio | "";
  ciudad: string;
}

export interface OnboardingData {
  account: OnboardingAccount;
  negocio: OnboardingNegocio;
  servicios: Servicio[];
  horario: Horario;
  equipo: MiembroEquipo[];
}

/** Result returned by the server action that finalizes onboarding */
export interface FinishOnboardingResult {
  ok: boolean;
  slug?: string;
  error?: string;
}
