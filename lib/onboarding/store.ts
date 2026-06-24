"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DAYS, newServiceId, businessTypeLabel, TOTAL_CONFIG_STEPS } from "./data";
import type {
  DayId,
  Schedule,
  TeamMember,
  OnboardingData,
  Service,
  BusinessType,
} from "./types";

function initialSchedule(): Schedule {
  const s = {} as Schedule;
  DAYS.forEach((day, i) => {
    s[day.id] = { on: i < 5, from: "09:00", to: "18:00" };
  });
  return s;
}

function initialState(): OnboardingData {
  return {
    account:  { name: "", email: "", password: "", googleAuthed: false, emailAuthed: false },
    business: { name: "", type: "", city: "" },
    services: [],
    schedule: initialSchedule(),
    team:     [{ name: "", role: "", owner: true }],
  };
}

interface OnboardingStore {
  step: number;
  d: OnboardingData;

  // navigation
  goNext: () => void;
  goBack: () => void;
  goTo: (step: number) => void;

  // step 0 — account
  setName:          (v: string) => void;
  setEmail:         (v: string) => void;
  setPassword:      (v: string) => void;
  setGoogleAuthed:  (name: string, email: string) => void;
  setEmailAuthed:   (name: string, email: string) => void;

  // step 1 — business
  setBusinessName:  (v: string) => void;
  setBusinessType:  (v: BusinessType) => void;
  setBusinessCity:  (v: string) => void;

  // step 2 — services
  addService:    (name?: string, min?: number, price?: number) => void;
  updateService: (id: string, patch: Partial<Omit<Service, "id">>) => void;
  removeService: (id: string) => void;

  // step 3 — schedule
  setScheduleDay: (day: DayId, patch: Partial<Schedule[DayId]>) => void;

  // step 4 — team
  addMember:    () => void;
  updateMember: (index: number, patch: Partial<TeamMember>) => void;
  removeMember: (index: number) => void;

  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      step: 0,
      d: initialState(),

      goNext: () =>
        set((s) => {
          const next = Math.min(s.step + 1, 5);
          let d = s.d;
          // When entering "team" step, pre-fill the owner with account data
          if (next === 4 && !s.d.team[0]?.name.trim()) {
            const team = [...s.d.team];
            team[0] = {
              ...team[0],
              name: s.d.account.name || "Tú",
              role: businessTypeLabel(s.d.business.type) || "Profesional",
            };
            d = { ...s.d, team };
          }
          return { step: next, d };
        }),

      goBack: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
      goTo:   (step) => set({ step: Math.max(0, Math.min(step, 5)) }),

      setName:     (v) => set((s) => ({ d: { ...s.d, account: { ...s.d.account, name: v } } })),
      setEmail:    (v) => set((s) => ({ d: { ...s.d, account: { ...s.d.account, email: v } } })),
      setPassword: (v) => set((s) => ({ d: { ...s.d, account: { ...s.d.account, password: v } } })),
      setGoogleAuthed: (name, email) =>
        set((s) => ({
          d: {
            ...s.d,
            account: {
              ...s.d.account,
              googleAuthed: true,
              name:  s.d.account.name  || name,
              email: s.d.account.email || email,
            },
          },
        })),
      setEmailAuthed: (name, email) =>
        set((s) => ({
          d: {
            ...s.d,
            account: {
              ...s.d.account,
              emailAuthed: true,
              name:  s.d.account.name  || name,
              email: s.d.account.email || email,
            },
          },
        })),

      setBusinessName: (v) => set((s) => ({ d: { ...s.d, business: { ...s.d.business, name: v } } })),
      setBusinessType: (v) => set((s) => ({ d: { ...s.d, business: { ...s.d.business, type: v } } })),
      setBusinessCity: (v) => set((s) => ({ d: { ...s.d, business: { ...s.d.business, city: v } } })),

      addService: (name = "", min = 60, price = 40) =>
        set((s) => ({
          d: { ...s.d, services: [...s.d.services, { id: newServiceId(), name, min, price }] },
        })),
      updateService: (id, patch) =>
        set((s) => ({
          d: {
            ...s.d,
            services: s.d.services.map((srv) => (srv.id === id ? { ...srv, ...patch } : srv)),
          },
        })),
      removeService: (id) =>
        set((s) => ({ d: { ...s.d, services: s.d.services.filter((srv) => srv.id !== id) } })),

      setScheduleDay: (day, patch) =>
        set((s) => ({
          d: { ...s.d, schedule: { ...s.d.schedule, [day]: { ...s.d.schedule[day], ...patch } } },
        })),

      addMember: () =>
        set((s) => ({ d: { ...s.d, team: [...s.d.team, { name: "", role: "", owner: false }] } })),
      updateMember: (index, patch) =>
        set((s) => ({
          d: { ...s.d, team: s.d.team.map((m, i) => (i === index ? { ...m, ...patch } : m)) },
        })),
      removeMember: (index) =>
        set((s) => ({ d: { ...s.d, team: s.d.team.filter((_, i) => i !== index) } })),

      reset: () => set({ step: 0, d: initialState() }),
    }),
    {
      name: "kalendar-onboarding",
      storage: createJSONStorage(() => sessionStorage),
      // sessionStorage (not localStorage): survives Google OAuth redirect but
      // clears when the tab closes.
    }
  )
);

export { TOTAL_CONFIG_STEPS };
