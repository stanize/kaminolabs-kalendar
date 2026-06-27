export type BusinessType =
  | "psychology"
  | "nutrition"
  | "physiotherapy"
  | "beauty"
  | "fitness"
  | "coaching"
  | "tutoring"
  | "other";

export type DayId = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

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
