"use server";

import { createClient } from "@/lib/supabase/server";
import { DIAS } from "@/lib/onboarding/data";
import { slugify } from "@/lib/onboarding/slug";
import type { FinishOnboardingResult, OnboardingData } from "@/lib/onboarding/types";

const MAX_SLUG_INTENTOS = 25;

export async function finishOnboarding(d: OnboardingData): Promise<FinishOnboardingResult> {
  const supabase = await createClient();

  // 1) Cuenta — si vino por Google ya hay sesión; si no, la creamos ahora (al final del flujo)
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  let userId = existingUser?.id;

  if (!userId) {
    if (!d.account.email || d.account.password.length < 6) {
      return { ok: false, error: "Faltan datos de la cuenta. Vuelve al primer paso." };
    }
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: d.account.email.trim(),
      password: d.account.password,
      options: { data: { nombre: d.account.nombre.trim() } },
    });
    if (signUpError || !signUpData.user) {
      const msg =
        signUpError?.message?.toLowerCase().includes("already") ||
        signUpError?.code === "user_already_exists"
          ? "Ya existe una cuenta con ese correo. Inicia sesión en su lugar."
          : "No se pudo crear la cuenta. Inténtalo de nuevo.";
      return { ok: false, error: msg };
    }
    userId = signUpData.user.id;
  }

  if (!userId) {
    return { ok: false, error: "No se pudo verificar tu cuenta. Inténtalo de nuevo." };
  }

  // 2) Negocio — intentamos reclamar el slug, añadiendo un sufijo si ya existe
  const base = slugify(d.negocio.nombre);
  let slug = base;
  let negocioId: string | null = null;

  for (let intento = 0; intento < MAX_SLUG_INTENTOS; intento++) {
    const candidato = intento === 0 ? base : `${base}-${intento + 1}`;
    const { data: negocio, error } = await supabase
      .from("businesses")
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

    // 23505 = unique_violation (slug ya existe) → probamos el siguiente sufijo
    if (error && error.code !== "23505") {
      return { ok: false, error: "No se pudo guardar tu negocio. Inténtalo de nuevo." };
    }
  }

  if (!negocioId) {
    return { ok: false, error: "No se pudo asignar un enlace único. Prueba con otro nombre." };
  }

  // 3) Servicios
  if (d.servicios.length > 0) {
    const { error } = await supabase.from("services").insert(
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

  // 4) Horario
  const { error: horarioError } = await supabase.from("business_hours").insert(
    DIAS.map((dia) => ({
      business_id: negocioId,
      dia: dia.id,
      activo: d.horario[dia.id].on,
      hora_inicio: d.horario[dia.id].on ? d.horario[dia.id].desde : null,
      hora_fin: d.horario[dia.id].on ? d.horario[dia.id].hasta : null,
    }))
  );
  if (horarioError) return { ok: false, error: "No se pudo guardar tu disponibilidad." };

  // 5) Equipo
  const { error: equipoError } = await supabase.from("team_members").insert(
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
