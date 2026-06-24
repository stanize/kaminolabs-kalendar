export type BusinessType =
  | "psico"
  | "nutri"
  | "fisio"
  | "belleza"
  | "fitness"
  | "coaching"
  | "tutorias"
  | "otro";

export type DayId = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";

export interface Service {
  id: string;
  name: string;
  min: number;
  price: number;
}

export interface DaySchedule {
  on: boolean;
  from: string;
  to: string;
}

export type Schedule = Record<DayId, DaySchedule>;

export interface TeamMember {
  name: string;
  role: string;
  owner: boolean;
}

export interface OnboardingAccount {
  name: string;
  email: string;
  password: string;
  /** true once the person has authenticated via Google OAuth */
  googleAuthed: boolean;
  /** true once the person has signed up or signed in via email+password */
  emailAuthed: boolean;
}

export interface OnboardingBusiness {
  name: string;
  type: BusinessType | "";
  city: string;
}

export interface OnboardingData {
  account: OnboardingAccount;
  business: OnboardingBusiness;
  services: Service[];
  schedule: Schedule;
  team: TeamMember[];
}

/** Result returned by the server action that finalizes onboarding */
export interface OnboardingResult {
  ok: boolean;
  slug?: string;
  error?: string;
}
