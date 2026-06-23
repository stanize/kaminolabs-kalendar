import type { OnboardingData } from "@/lib/onboarding/types";

function ejemplo(partial: {
  nombre: string;
  tipo: OnboardingData["negocio"]["tipo"];
  servicios: OnboardingData["servicios"];
}): OnboardingData {
  return {
    account: { nombre: "", email: "", password: "", googleAuthed: false },
    negocio: { nombre: partial.nombre, tipo: partial.tipo, ciudad: "" },
    servicios: partial.servicios,
    horario: {
      lun: { on: true, desde: "09:00", hasta: "18:00" },
      mar: { on: true, desde: "09:00", hasta: "18:00" },
      mie: { on: true, desde: "09:00", hasta: "18:00" },
      jue: { on: true, desde: "09:00", hasta: "18:00" },
      vie: { on: true, desde: "09:00", hasta: "18:00" },
      sab: { on: false, desde: "09:00", hasta: "18:00" },
      dom: { on: false, desde: "09:00", hasta: "18:00" },
    },
    equipo: [{ nombre: "", rol: "", owner: true }],
  };
}

export const EJEMPLOS_LANDING: OnboardingData[] = [
  ejemplo({
    nombre: "Centro Bienestar Serena",
    tipo: "psico",
    servicios: [
      { id: "1", nombre: "Primera consulta", min: 50, precio: 60 },
      { id: "2", nombre: "Sesión de seguimiento", min: 45, precio: 45 },
    ],
  }),
  ejemplo({
    nombre: "Fisio Activa",
    tipo: "fisio",
    servicios: [
      { id: "1", nombre: "Primera valoración", min: 50, precio: 50 },
      { id: "2", nombre: "Sesión de fisioterapia", min: 60, precio: 45 },
    ],
  }),
  ejemplo({
    nombre: "Glow Beauty Studio",
    tipo: "belleza",
    servicios: [
      { id: "1", nombre: "Limpieza facial", min: 60, precio: 45 },
      { id: "2", nombre: "Manicura", min: 45, precio: 25 },
    ],
  }),
  ejemplo({
    nombre: "Nutri Vida",
    tipo: "nutri",
    servicios: [
      { id: "1", nombre: "Primera visita", min: 60, precio: 55 },
      { id: "2", nombre: "Plan online", min: 45, precio: 40 },
    ],
  }),
];
