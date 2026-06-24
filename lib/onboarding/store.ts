"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DIAS, newServicioId, tipoLabel, TOTAL_PASOS_CONFIG } from "./data";
import type {
  DiaId,
  Horario,
  MiembroEquipo,
  OnboardingData,
  Servicio,
  TipoNegocio,
} from "./types";

function horarioInicial(): Horario {
  const h = {} as Horario;
  DIAS.forEach((dia, i) => {
    h[dia.id] = { on: i < 5, desde: "09:00", hasta: "18:00" };
  });
  return h;
}

function estadoInicial(): OnboardingData {
  return {
    account: { nombre: "", email: "", password: "", googleAuthed: false, emailAuthed: false },
    negocio: { nombre: "", tipo: "", ciudad: "" },
    servicios: [],
    horario: horarioInicial(),
    equipo: [{ nombre: "", rol: "", owner: true }],
  };
}

interface OnboardingStore {
  paso: number;
  d: OnboardingData;

  // navegación
  goNext: () => void;
  goBack: () => void;
  goTo: (paso: number) => void;

  // paso 0 — cuenta
  setNombre: (v: string) => void;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setGoogleAuthed: (nombre: string, email: string) => void;
  setEmailAuthed: (nombre: string, email: string) => void;

  // paso 1 — negocio
  setNegocioNombre: (v: string) => void;
  setNegocioTipo: (v: TipoNegocio) => void;
  setNegocioCiudad: (v: string) => void;

  // paso 2 — servicios
  addServicio: (nombre?: string, min?: number, precio?: number) => void;
  updateServicio: (id: string, patch: Partial<Omit<Servicio, "id">>) => void;
  removeServicio: (id: string) => void;

  // paso 3 — horario
  setHorarioDia: (dia: DiaId, patch: Partial<Horario[DiaId]>) => void;

  // paso 4 — equipo
  addMiembro: () => void;
  updateMiembro: (index: number, patch: Partial<MiembroEquipo>) => void;
  removeMiembro: (index: number) => void;

  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      paso: 0,
      d: estadoInicial(),

      goNext: () =>
        set((s) => {
          const siguiente = Math.min(s.paso + 1, 5);
          let d = s.d;
          // Al entrar en "equipo", precargamos al propietario con los datos de la cuenta
          if (siguiente === 4 && !s.d.equipo[0]?.nombre.trim()) {
            const equipo = [...s.d.equipo];
            equipo[0] = {
              ...equipo[0],
              nombre: s.d.account.nombre || "Tú",
              rol: tipoLabel(s.d.negocio.tipo) || "Profesional",
            };
            d = { ...s.d, equipo };
          }
          return { paso: siguiente, d };
        }),

      goBack: () => set((s) => ({ paso: Math.max(0, s.paso - 1) })),
      goTo: (paso) => set({ paso: Math.max(0, Math.min(paso, 5)) }),

      setNombre: (v) => set((s) => ({ d: { ...s.d, account: { ...s.d.account, nombre: v } } })),
      setEmail: (v) => set((s) => ({ d: { ...s.d, account: { ...s.d.account, email: v } } })),
      setPassword: (v) =>
        set((s) => ({ d: { ...s.d, account: { ...s.d.account, password: v } } })),
      setGoogleAuthed: (nombre, email) =>
        set((s) => ({
          d: {
            ...s.d,
            account: {
              ...s.d.account,
              googleAuthed: true,
              nombre: s.d.account.nombre || nombre,
              email: s.d.account.email || email,
            },
          },
        })),
      setEmailAuthed: (nombre, email) =>
        set((s) => ({
          d: {
            ...s.d,
            account: {
              ...s.d.account,
              emailAuthed: true,
              nombre: s.d.account.nombre || nombre,
              email: s.d.account.email || email,
            },
          },
        })),

      setNegocioNombre: (v) =>
        set((s) => ({ d: { ...s.d, negocio: { ...s.d.negocio, nombre: v } } })),
      setNegocioTipo: (v) => set((s) => ({ d: { ...s.d, negocio: { ...s.d.negocio, tipo: v } } })),
      setNegocioCiudad: (v) =>
        set((s) => ({ d: { ...s.d, negocio: { ...s.d.negocio, ciudad: v } } })),

      addServicio: (nombre = "", min = 60, precio = 40) =>
        set((s) => ({
          d: {
            ...s.d,
            servicios: [...s.d.servicios, { id: newServicioId(), nombre, min, precio }],
          },
        })),
      updateServicio: (id, patch) =>
        set((s) => ({
          d: {
            ...s.d,
            servicios: s.d.servicios.map((srv) => (srv.id === id ? { ...srv, ...patch } : srv)),
          },
        })),
      removeServicio: (id) =>
        set((s) => ({ d: { ...s.d, servicios: s.d.servicios.filter((srv) => srv.id !== id) } })),

      setHorarioDia: (dia, patch) =>
        set((s) => ({
          d: { ...s.d, horario: { ...s.d.horario, [dia]: { ...s.d.horario[dia], ...patch } } },
        })),

      addMiembro: () =>
        set((s) => ({ d: { ...s.d, equipo: [...s.d.equipo, { nombre: "", rol: "", owner: false }] } })),
      updateMiembro: (index, patch) =>
        set((s) => ({
          d: {
            ...s.d,
            equipo: s.d.equipo.map((m, i) => (i === index ? { ...m, ...patch } : m)),
          },
        })),
      removeMiembro: (index) =>
        set((s) => ({ d: { ...s.d, equipo: s.d.equipo.filter((_, i) => i !== index) } })),

      reset: () => set({ paso: 0, d: estadoInicial() }),
    }),
    {
      name: "kalendar-onboarding",
      storage: createJSONStorage(() => sessionStorage),
      // sessionStorage (no localStorage) on purpose: state must survive the
      // Google OAuth redirect round-trip, but shouldn't linger beyond the tab/session.
    }
  )
);

export { TOTAL_PASOS_CONFIG };
