"use client";

import { useEffect, useRef, useState } from "react";
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
import { canProceed } from "@/lib/onboarding/validation";
import { STEPS } from "@/lib/onboarding/data";
import { slugify } from "@/lib/onboarding/slug";
import type { OnboardingData } from "@/lib/onboarding/types";

const STEP_COMPONENTS = [StepCuenta, StepNegocio, StepServicios, StepHorario, StepEquipo];

export function OnboardingFlow() {
  const step            = useOnboardingStore((s) => s.step);
  const d               = useOnboardingStore((s) => s.d);
  const goNext          = useOnboardingStore((s) => s.goNext);
  const goBack          = useOnboardingStore((s) => s.goBack);
  const goTo            = useOnboardingStore((s) => s.goTo);
  const setGoogleAuthed = useOnboardingStore((s) => s.setGoogleAuthed);
  const reset           = useOnboardingStore((s) => s.reset);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [userName, setUserName]     = useState<string>("");

  const [completed, setCompleted] = useState(false);
  const [finalData, setFinalData] = useState<OnboardingData | null>(null);
  const [finalSlug, setFinalSlug] = useState<string>("");

  const advancedRef = useRef(false);

  function advanceFromStep0(firstName: string) {
    if (advancedRef.current) return;
    advancedRef.current = true;
    setUserName(firstName);
    goTo(1);
  }

  useEffect(() => {
    const state = useOnboardingStore.getState();
    if (state.d.account.emailAuthed) {
      const firstName = state.d.account.name.split(" ")[0] ?? state.d.account.name;
      advanceFromStep0(firstName);
      return;
    }

    authClient.getSession().then(({ data: session }) => {
      if (!session?.user) return;
      const current = useOnboardingStore.getState();
      if (current.d.account.emailAuthed) return;
      const fullName  = session.user.name ?? "";
      const firstName = fullName.split(" ")[0] ?? fullName;
      if (!current.d.account.googleAuthed) {
        current.setGoogleAuthed(fullName, session.user.email ?? "");
      }
      if (current.step === 0) advanceFromStep0(firstName);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (d.account.emailAuthed && step === 0) {
      const firstName = d.account.name.split(" ")[0] ?? d.account.name;
      advanceFromStep0(firstName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.account.emailAuthed]);

  const canNext = canProceed(step, d);

  const meta  = STEPS[step];
  const title = step === 1 && userName ? `¡Hola, ${userName}!` : meta.title;
  const sub   = step === 1 && userName ? "Cuéntanos un poco sobre tu negocio." : meta.sub;

  async function handleContinue() {
    setError(null);
    if (!canNext) return;

    if (step === 4) {
      setSubmitting(true);
      try {
        const result = await finishOnboarding(d);
        if (!result.ok) {
          setError(result.error ?? "Ha ocurrido un error. Inténtalo de nuevo.");
          return;
        }
        setFinalData(d);
        setFinalSlug(result.slug ?? slugify(d.business.name));
        setCompleted(true);
        reset();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Error inesperado: ${msg}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    goNext();
  }

  if (completed && finalData) {
    return <StepListo d={finalData} slug={finalSlug} />;
  }

  const StepComponent = STEP_COMPONENTS[step];

  // Debug info shown only in development
  const isDev = process.env.NODE_ENV === "development";

  return (
    <SplitShell
      step={step}
      title={title}
      sub={sub}
      d={d}
      footer={
        <>
          {isDev && (
            <details className="mt-3 rounded-lg border border-line bg-surface-2 p-3 text-[11px] text-ink-soft">
              <summary className="cursor-pointer font-mono">debug: step {step} · canNext={String(canNext)}</summary>
              <pre className="mt-2 overflow-auto">{JSON.stringify({ step, canNext, account: d.account, business: d.business }, null, 2)}</pre>
            </details>
          )}
          <NavBtns
            step={step}
            canNext={canNext}
            next={handleContinue}
            back={goBack}
            loading={submitting}
            errorMsg={error}
          />
        </>
      }
    >
      <StepComponent />
    </SplitShell>
  );
}
