"use client";

import { useEffect, useState } from "react";
import { SplitShell } from "@/components/onboarding/split-shell";
import { NavBtns } from "@/components/onboarding/nav-buttons";
import { StepCuenta } from "@/components/onboarding/step-cuenta";
import { StepNegocio } from "@/components/onboarding/step-negocio";
import { StepServicios } from "@/components/onboarding/step-servicios";
import { StepHorario } from "@/components/onboarding/step-horario";
import { StepEquipo } from "@/components/onboarding/step-equipo";
import { StepListo } from "@/components/onboarding/step-listo";
import { createClient } from "@/lib/supabase/client";
import { finishOnboarding } from "@/lib/actions/onboarding";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { canAdvance } from "@/lib/onboarding/validation";
import { PASOS } from "@/lib/onboarding/data";
import { slugify } from "@/lib/onboarding/slug";
import type { OnboardingData } from "@/lib/onboarding/types";

const STEP_CONTENT = [StepCuenta, StepNegocio, StepServicios, StepHorario, StepEquipo];

export function OnboardingFlow() {
  const paso = useOnboardingStore((s) => s.paso);
  const d = useOnboardingStore((s) => s.d);
  const goNext = useOnboardingStore((s) => s.goNext);
  const goBack = useOnboardingStore((s) => s.goBack);
  const goTo = useOnboardingStore((s) => s.goTo);
  const setGoogleAuthed = useOnboardingStore((s) => s.setGoogleAuthed);
  const reset = useOnboardingStore((s) => s.reset);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resultado final: capturado al terminar, antes de limpiar el store.
  const [terminado, setTerminado] = useState(false);
  const [dFinal, setDFinal] = useState<OnboardingData | null>(null);
  const [slugFinal, setSlugFinal] = useState<string>("");

  // Si volvemos de la redirección de Google, recuperamos la sesión y avanzamos.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && !d.account.googleAuthed) {
        const nombre =
          (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          "";
        setGoogleAuthed(nombre, user.email ?? "");
        if (paso === 0) goTo(1);
      }
    });
    // Solo al montar — el store ya gestiona los cambios posteriores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canNext = canAdvance(paso, d);
  const meta = PASOS[paso];

  async function manejarContinuar() {
    setError(null);
    if (!canNext) return;

    if (paso === 4) {
      setEnviando(true);
      const resultado = await finishOnboarding(d);
      setEnviando(false);
      if (!resultado.ok) {
        setError(resultado.error ?? "Ha ocurrido un error. Inténtalo de nuevo.");
        return;
      }
      // Guardamos una foto fija de los datos para la pantalla de éxito
      // y solo entonces limpiamos el store (sessionStorage incluido).
      setDFinal(d);
      setSlugFinal(resultado.slug ?? slugify(d.negocio.nombre));
      setTerminado(true);
      reset();
      return;
    }

    goNext();
  }

  if (terminado && dFinal) {
    return <StepListo d={dFinal} slug={slugFinal} />;
  }

  const StepContent = STEP_CONTENT[paso];

  return (
    <SplitShell
      paso={paso}
      titulo={meta.titulo}
      sub={meta.sub}
      d={d}
      footer={
        <NavBtns
          paso={paso}
          canNext={canNext}
          next={manejarContinuar}
          back={goBack}
          loading={enviando}
          errorMsg={error}
        />
      }
    >
      <StepContent />
    </SplitShell>
  );
}
