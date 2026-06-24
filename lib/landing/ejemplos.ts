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
      lun: { on: true,  from: "09:00", to: "18:00" },
      mar: { on: true,  from: "09:00", to: "18:00" },
      mie: { on: true,  from: "09:00", to: "18:00" },
      jue: { on: true,  from: "09:00", to: "18:00" },
      vie: { on: true,  from: "09:00", to: "18:00" },
      sab: { on: false, from: "09:00", to: "18:00" },
      dom: { on: false, from: "09:00", to: "18:00" },
    },
    team: [{ name: "", role: "", owner: true }],
  };
}

export const LANDING_EXAMPLES: OnboardingData[] = [
  example({
    name: "Centro Bienestar Serena",
    type: "psico",
    services: [
      { id: "1", name: "Primera consulta",      min: 50, price: 60 },
      { id: "2", name: "Sesión de seguimiento", min: 45, price: 45 },
    ],
  }),
  example({
    name: "Fisio Activa",
    type: "fisio",
    services: [
      { id: "1", name: "Primera valoración",       min: 50, price: 50 },
      { id: "2", name: "Sesión de fisioterapia",   min: 60, price: 45 },
    ],
  }),
  example({
    name: "Glow Beauty Studio",
    type: "belleza",
    services: [
      { id: "1", name: "Limpieza facial", min: 60, price: 45 },
      { id: "2", name: "Manicura",        min: 45, price: 25 },
    ],
  }),
  example({
    name: "Nutri Vida",
    type: "nutri",
    services: [
      { id: "1", name: "Primera visita", min: 60, price: 55 },
      { id: "2", name: "Plan online",    min: 45, price: 40 },
    ],
  }),
];
