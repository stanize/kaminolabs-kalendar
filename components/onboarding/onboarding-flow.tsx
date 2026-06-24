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

  // Guard: ensure we only advance from step 0 once, regardless of how many
  // effects fire (email signUp creates a session immediately, so both the
  // emailAuthed watcher and the getSession callback can race).
  const advancedRef = useRef(false);

  function advanceFromStep0(firstName: string) {
    if (advancedRef.current) return;
    advancedRef.current = true;
    setUserName(firstName);
    goTo(1);
  }

  // On mount: handle Google OAuth redirect or page refresh with existing session.
  // If emailAuthed is already set (email signup just completed), skip getSession
  // entirely — the emailAuthed watcher below will handle the advance.
  useEffect(() => {
    // Read fresh state directly from the store (not the stale closure)
    const state = useOnboardingStore.getState();
    if (state.d.account.emailAuthed) {
      const firstName = state.d.account.name.split(" ")[0] ?? state.d.account.name;
      advanceFromStep0(firstName);
      return;
    }

    authClient.getSession().then(({ data: session }) => {
      if (!session?.user) return;
      // Re-read store state here — it may have changed since mount
      const current = useOnboardingStore.getState();
      if (current.d.account.emailAuthed) {
        // Email signup completed while getSession was in-flight — do nothing,
        // the emailAuthed watcher already handled (or will handle) the advance.
        return;
      }
      const fullName  = session.user.name ?? "";
      const firstName = fullName.split(" ")[0] ?? fullName;
      if (!current.d.account.googleAuthed) {
        current.setGoogleAuthed(fullName, session.user.email ?? "");
      }
      if (current.step === 0) advanceFromStep0(firstName);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch for emailAuthed flipping true (set synchronously in step-cuenta after signUp).
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
      const result = await finishOnboarding(d);
      setSubmitting(false);
      if (!result.ok) {
        setError(result.error ?? "Ha ocurrido un error. Inténtalo de nuevo.");
        return;
      }
      setFinalData(d);
      setFinalSlug(result.slug ?? slugify(d.business.name));
      setCompleted(true);
      reset();
      return;
    }

    goNext();
  }

  if (completed && finalData) {
    return <StepListo d={finalData} slug={finalSlug} />;
  }

  const StepComponent = STEP_COMPONENTS[step];

  return (
    <SplitShell
      step={step}
      title={title}
      sub={sub}
      d={d}
      footer={
        <NavBtns
          step={step}
          canNext={canNext}
          next={handleContinue}
          back={goBack}
          loading={submitting}
          errorMsg={error}
        />
      }
    >
      <StepComponent />
    </SplitShell>
  );
}
