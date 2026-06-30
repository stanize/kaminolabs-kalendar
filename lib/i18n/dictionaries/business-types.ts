import type { Locale } from "../config";
import type { BusinessType } from "@/lib/onboarding/types";

/**
 * Translations for business type labels (Psicología, Nutrición, ...). Shared
 * because the same ids are used in multiple places: the home page's "who it's
 * for" display cards, the onboarding/panel business-type picker, and the
 * public booking page header. Kept separate from public.ts since it's keyed by
 * BusinessType id rather than belonging to one page's flow.
 */
const LABELS: Record<Locale, Record<BusinessType, string>> = {
  es: {
    psychology: "Psicología",
    nutrition: "Nutrición",
    physiotherapy: "Fisioterapia",
    beauty: "Estética y belleza",
    fitness: "Fitness y entreno",
    coaching: "Coaching",
    tutoring: "Clases y tutorías",
    other: "Otro",
  },
  en: {
    psychology: "Psychology",
    nutrition: "Nutrition",
    physiotherapy: "Physiotherapy",
    beauty: "Beauty & aesthetics",
    fitness: "Fitness & training",
    coaching: "Coaching",
    tutoring: "Classes & tutoring",
    other: "Other",
  },
};

export function businessTypeLabelFor(type: BusinessType, locale: Locale): string {
  return LABELS[locale][type];
}
