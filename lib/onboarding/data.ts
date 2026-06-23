import type { DiaId, TipoNegocio } from "./types";

export const PASOS = [
  { id: "cuenta", titulo: "Crea tu cuenta", sub: "Gratis para empezar. Sin tarjeta." },
  { id: "negocio", titulo: "Cuéntanos de tu negocio", sub: "Así te verán tus clientes al reservar." },
  { id: "servicios", titulo: "Añade tus servicios", sub: "Lo que la gente podrá reservar contigo." },
  { id: "horario", titulo: "Define tu disponibilidad", sub: "Las horas en las que aceptas citas." },
  { id: "equipo", titulo: "Tu equipo", sub: "¿Trabajas en solitario o con más gente?" },
  { id: "listo", titulo: "¡Todo listo!", sub: "Tu página de reservas ya está activa." },
] as const;

/** Total configuration steps (excludes the final "listo" success screen) */
export const TOTAL_PASOS_CONFIG = PASOS.length - 1;

export const TIPOS: { id: TipoNegocio; label: string; icon: string }[] = [
  { id: "psico", label: "Psicología", icon: "user" },
  { id: "nutri", label: "Nutrición", icon: "leaf" },
  { id: "fisio", label: "Fisioterapia", icon: "sparkles" },
  { id: "belleza", label: "Estética y belleza", icon: "sparkles" },
  { id: "fitness", label: "Fitness y entreno", icon: "sparkles" },
  { id: "coaching", label: "Coaching", icon: "users" },
  { id: "tutorias", label: "Clases y tutorías", icon: "list" },
  { id: "otro", label: "Otro", icon: "grid" },
];

export function tipoLabel(tipo: TipoNegocio | ""): string {
  return TIPOS.find((t) => t.id === tipo)?.label ?? "";
}

export function tipoIcon(tipo: TipoNegocio | ""): string {
  return TIPOS.find((t) => t.id === tipo)?.icon ?? "calendar";
}

/** [nombre, minutos, precioEUR][] */
export const PLANTILLAS: Record<TipoNegocio, [string, number, number][]> = {
  psico: [
    ["Primera consulta", 50, 60],
    ["Sesión de seguimiento", 45, 45],
    ["Consulta online", 45, 40],
  ],
  nutri: [
    ["Primera visita", 60, 55],
    ["Seguimiento", 30, 35],
    ["Plan online", 45, 40],
  ],
  fisio: [
    ["Primera valoración", 50, 50],
    ["Sesión de fisioterapia", 60, 45],
  ],
  belleza: [
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
  tutorias: [
    ["Clase particular", 60, 25],
    ["Clase en grupo", 60, 15],
  ],
  otro: [["Cita estándar", 60, 40]],
};

export const DIAS: { id: DiaId; label: string; corto: string }[] = [
  { id: "lun", label: "Lunes", corto: "lun" },
  { id: "mar", label: "Martes", corto: "mar" },
  { id: "mie", label: "Miércoles", corto: "mié" },
  { id: "jue", label: "Jueves", corto: "jue" },
  { id: "vie", label: "Viernes", corto: "vie" },
  { id: "sab", label: "Sábado", corto: "sáb" },
  { id: "dom", label: "Domingo", corto: "dom" },
];

/** Every 30 minutes from 07:00 to 22:00 */
export const HORAS: string[] = (() => {
  const a: string[] = [];
  for (let h = 7; h <= 22; h++) {
    a.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 22) a.push(`${String(h).padStart(2, "0")}:30`);
  }
  return a;
})();

let _sid = 0;
export function newServicioId(): string {
  _sid += 1;
  return `srv${_sid}_${Date.now().toString(36)}`;
}
