import type { OnboardingData } from "@/lib/onboarding/types";

function example(partial: {
  name: string;
  type: OnboardingData["business"]["type"];
  services: OnboardingData["services"];
}): OnboardingData {
  return {
    account:  { name: "", email: "", password: "", googleAuthed: false, emailAuthed: false },
    business: { name: partial.name, type: partial.type, city: "" },
    services: partial.services,
    schedule: {
      mon: { on: true,  from: "09:00", to: "18:00" },
      tue: { on: true,  from: "09:00", to: "18:00" },
      wed: { on: true,  from: "09:00", to: "18:00" },
      thu: { on: true,  from: "09:00", to: "18:00" },
      fri: { on: true,  from: "09:00", to: "18:00" },
      sat: { on: false, from: "09:00", to: "18:00" },
      sun: { on: false, from: "09:00", to: "18:00" },
    },
    team: [{ name: "", role: "", owner: true }],
  };
}

export const LANDING_EXAMPLES: OnboardingData[] = [
  example({
    name: "Centro Bienestar Serena",
    type: "psychology",
    services: [
      { id: "1", name: "Primera consulta",      min: 50, price: 60 },
      { id: "2", name: "Sesión de seguimiento", min: 45, price: 45 },
    ],
  }),
  example({
    name: "Fisio Activa",
    type: "physiotherapy",
    services: [
      { id: "1", name: "Primera valoración",       min: 50, price: 50 },
      { id: "2", name: "Sesión de fisioterapia",   min: 60, price: 45 },
    ],
  }),
  example({
    name: "Glow Beauty Studio",
    type: "beauty",
    services: [
      { id: "1", name: "Limpieza facial", min: 60, price: 45 },
      { id: "2", name: "Manicura",        min: 45, price: 25 },
    ],
  }),
  example({
    name: "Nutri Vida",
    type: "nutrition",
    services: [
      { id: "1", name: "Primera visita", min: 60, price: 55 },
      { id: "2", name: "Plan online",    min: 45, price: 40 },
    ],
  }),
];
