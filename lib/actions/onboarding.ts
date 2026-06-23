"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DIAS } from "@/lib/onboarding/data";
import { slugify } from "@/lib/onboarding/slug";
import type { FinishOnboardingResult, OnboardingData } from "@/lib/onboarding/types";

const MAX_SLUG_INTENTOS = 25;

export async function finishOnboarding(d: OnboardingData): Promise<FinishOnboardingResult> {
  // Get session from Better Auth
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { ok: false, error: "No se pudo verificar tu cuenta. Inténtalo de nuevo." };
  }

  const userId = session.user.id;
  const supabase = await createClient();

  // Negocio — slug with uniqueness retry
  const base = slugify(d.negocio.nombre);
  let slug = base;
  let negocioId: string | null = null;

  for (let intento = 0; intento < MAX_SLUG_INTENTOS; intento++) {
    const candidato = intento === 0 ? base : `${base}-${intento + 1}`;
    const { data: negocio, error } = await supabase
      .from("kalendar_businesses")
      .insert({
        owner_id: userId,
        nombre: d.negocio.nombre.trim(),
        tipo: d.negocio.tipo || "otro",
        ciudad: d.negocio.ciudad?.trim() || null,
        slug: candidato,
        onboarding_completed_at: new Date().toISOString(),
      })
      .select("id, slug")
      .single();

    if (!error && negocio) {
      negocioId = negocio.id;
      slug = negocio.slug;
      break;
    }

    if (error && error.code !== "23505") {
      return { ok: false, error: "No se pudo guardar tu negocio. Inténtalo de nuevo." };
    }
  }

  if (!negocioId) {
    return { ok: false, error: "No se pudo asignar un enlace único. Prueba con otro nombre." };
  }

  // Servicios
  if (d.servicios.length > 0) {
    const { error } = await supabase.from("kalendar_services").insert(
      d.servicios.map((s, i) => ({
        business_id: negocioId,
        nombre: s.nombre.trim(),
        duracion_min: s.min,
        precio: s.precio,
        orden: i,
      }))
    );
    if (error) return { ok: false, error: "No se pudieron guardar tus servicios." };
  }

  // Horario
  const { error: horarioError } = await supabase.from("kalendar_business_hours").insert(
    DIAS.map((dia) => ({
      business_id: negocioId,
      dia: dia.id,
      activo: d.horario[dia.id].on,
      hora_inicio: d.horario[dia.id].on ? d.horario[dia.id].desde : null,
      hora_fin: d.horario[dia.id].on ? d.horario[dia.id].hasta : null,
    }))
  );
  if (horarioError) return { ok: false, error: "No se pudo guardar tu disponibilidad." };

  // Equipo
  const { error: equipoError } = await supabase.from("kalendar_team_members").insert(
    d.equipo.map((m, i) => ({
      business_id: negocioId,
      nombre: m.nombre.trim(),
      rol: m.rol?.trim() || null,
      es_propietario: m.owner,
      orden: i,
    }))
  );
  if (equipoError) return { ok: false, error: "No se pudo guardar tu equipo." };

  return { ok: true, slug };
}
