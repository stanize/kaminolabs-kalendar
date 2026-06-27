import type { DayId, BusinessType } from "./types";

export const STEPS = [
  { id: "account",      title: "Crea tu cuenta",             sub: "Gratis para empezar. Sin tarjeta." },
  { id: "business",     title: "Cuéntanos de tu negocio",    sub: "Así te verán tus clientes al reservar." },
  { id: "services",     title: "Añade tus servicios",        sub: "Lo que la gente podrá reservar contigo." },
  { id: "schedule",     title: "Define tu disponibilidad",   sub: "Las horas en las que aceptas citas." },
  { id: "team",         title: "Tu equipo",                  sub: "¿Trabajas en solitario o con más gente?" },
  { id: "done",         title: "¡Todo listo!",               sub: "Tu página de reservas ya está activa." },
] as const;

/** Total configuration steps (excludes the final "done" success screen) */
export const TOTAL_CONFIG_STEPS = STEPS.length - 1;

export const BUSINESS_TYPES: { id: BusinessType; label: string; icon: string }[] = [
  { id: "psychology",    label: "Psicología",        icon: "user" },
  { id: "nutrition",     label: "Nutrición",          icon: "leaf" },
  { id: "physiotherapy", label: "Fisioterapia",       icon: "sparkles" },
  { id: "beauty",        label: "Estética y belleza", icon: "sparkles" },
  { id: "fitness",       label: "Fitness y entreno",  icon: "sparkles" },
  { id: "coaching",      label: "Coaching",           icon: "users" },
  { id: "tutoring",      label: "Clases y tutorías",  icon: "list" },
  { id: "other",         label: "Otro",               icon: "grid" },
];

export function businessTypeLabel(type: BusinessType | ""): string {
  return BUSINESS_TYPES.find((t) => t.id === type)?.label ?? "";
}

export function businessTypeIcon(type: BusinessType | ""): string {
  return BUSINESS_TYPES.find((t) => t.id === type)?.icon ?? "calendar";
}

/** [name, minutes, priceEUR][] */
export const SERVICE_TEMPLATES: Record<BusinessType, [string, number, number][]> = {
  psychology: [
    ["Primera consulta", 50, 60],
    ["Sesión de seguimiento", 45, 45],
    ["Consulta online", 45, 40],
  ],
  nutrition: [
    ["Primera visita", 60, 55],
    ["Seguimiento", 30, 35],
    ["Plan online", 45, 40],
  ],
  physiotherapy: [
    ["Primera valoración", 50, 50],
    ["Sesión de fisioterapia", 60, 45],
  ],
  beauty: [
    ["Limpieza facial", 60, 45],
    ["Manicura", 45, 25],
    ["Maquillaje", 60, 40],
  ],
  fitness: [
    ["Entreno personal", 60, 40],
    ["Valoración inicial", 45, 30],
  ],
  coaching: [
    ["Sesión de coaching", 60, 70],
    ["Sesión inicial", 50, 55],
  ],
  tutoring: [
    ["Clase particular", 60, 25],
    ["Clase en grupo", 60, 15],
  ],
  other: [["Cita estándar", 60, 40]],
};

export const DAYS: { id: DayId; label: string; short: string }[] = [
  { id: "mon", label: "Lunes",      short: "lun" },
  { id: "tue", label: "Martes",     short: "mar" },
  { id: "wed", label: "Miércoles",  short: "mié" },
  { id: "thu", label: "Jueves",     short: "jue" },
  { id: "fri", label: "Viernes",    short: "vie" },
  { id: "sat", label: "Sábado",     short: "sáb" },
  { id: "sun", label: "Domingo",    short: "dom" },
];

/** Every 30 minutes from 07:00 to 22:00 */
export const HOURS: string[] = (() => {
  const a: string[] = [];
  for (let h = 7; h <= 22; h++) {
    a.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 22) a.push(`${String(h).padStart(2, "0")}:30`);
  }
  return a;
})();

let _sid = 0;
export function newServiceId(): string {
  _sid += 1;
  return `srv${_sid}_${Date.now().toString(36)}`;
}
