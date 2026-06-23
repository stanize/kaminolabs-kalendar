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
import { authClient } from "@/lib/auth-client";
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
  const [userName, setUserName] = useState<string>("");

  const [terminado, setTerminado] = useState(false);
  const [dFinal, setDFinal] = useState<OnboardingData | null>(null);
  const [slugFinal, setSlugFinal] = useState<string>("");

  useEffect(() => {
    authClient.getSession().then(({ data: session }) => {
      if (session?.user) {
        const name = session.user.name ?? "";
        // Use only the first name for the greeting
        const firstName = name.split(" ")[0] ?? name;
        setUserName(firstName);
        if (!d.account.googleAuthed) {
          setGoogleAuthed(name, session.user.email ?? "");
          if (paso === 0) goTo(1);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canNext = canAdvance(paso, d);

  const meta = PASOS[paso];
  const titulo = paso === 1 && userName
    ? `¡Hola, ${userName}!`
    : meta.titulo;
  const sub = paso === 1 && userName
    ? "Cuéntanos un poco sobre tu negocio."
    : meta.sub;

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
      titulo={titulo}
      sub={sub}
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
