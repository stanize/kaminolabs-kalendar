"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DAYS } from "@/lib/onboarding/data";
import { slugify } from "@/lib/onboarding/slug";
import type { OnboardingResult, OnboardingData } from "@/lib/onboarding/types";

const MAX_SLUG_ATTEMPTS = 25;

export async function finishOnboarding(d: OnboardingData): Promise<OnboardingResult> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return { ok: false, error: "No se pudo verificar tu cuenta. Inténtalo de nuevo." };
  }

  const userId = session.user.id;
  const supabase = await createClient();

  // Business — slug with uniqueness retry
  const base = slugify(d.business.name);
  let slug = base;
  let businessId: string | null = null;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data: business, error } = await supabase
      .from("kalendar_businesses")
      .insert({
        owner_id: userId,
        nombre:   d.business.name.trim(),
        tipo:     d.business.type || "otro",
        ciudad:   d.business.city?.trim() || null,
        slug:     candidate,
        onboarding_completed_at: new Date().toISOString(),
      })
      .select("id, slug")
      .single();

    if (!error && business) {
      businessId = business.id;
      slug = business.slug;
      break;
    }

    if (error && error.code !== "23505") {
      return { ok: false, error: "No se pudo guardar tu negocio. Inténtalo de nuevo." };
    }
  }

  if (!businessId) {
    return { ok: false, error: "No se pudo asignar un enlace único. Prueba con otro nombre." };
  }

  // Services
  if (d.services.length > 0) {
    const { error } = await supabase.from("kalendar_services").insert(
      d.services.map((s, i) => ({
        business_id:  businessId,
        nombre:       s.name.trim(),
        duracion_min: s.min,
        precio:       s.price,
        orden:        i,
      }))
    );
    if (error) return { ok: false, error: "No se pudieron guardar tus servicios." };
  }

  // Schedule
  const { error: scheduleError } = await supabase.from("kalendar_business_hours").insert(
    DAYS.map((day) => ({
      business_id: businessId,
      dia:         day.id,
      activo:      d.schedule[day.id].on,
      hora_inicio: d.schedule[day.id].on ? d.schedule[day.id].from : null,
      hora_fin:    d.schedule[day.id].on ? d.schedule[day.id].to   : null,
    }))
  );
  if (scheduleError) return { ok: false, error: "No se pudo guardar tu disponibilidad." };

  // Team
  const { error: teamError } = await supabase.from("kalendar_team_members").insert(
    d.team.map((m, i) => ({
      business_id:    businessId,
      nombre:         m.name.trim(),
      rol:            m.role?.trim() || null,
      es_propietario: m.owner,
      orden:          i,
    }))
  );
  if (teamError) return { ok: false, error: "No se pudo guardar tu equipo." };

  return { ok: true, slug };
}
