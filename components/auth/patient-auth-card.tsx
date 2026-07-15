"use client";

import { useState } from "react";
import { Logo } from "@/components/ui/logo";
import {
  PatientLoginForm,
  patientAuthHeading,
  type PatientAuthView,
} from "@/components/auth/patient-login-form";

export function PatientAuthCard({ redirectTo }: { redirectTo: string }) {
  const [view, setView] = useState<PatientAuthView>("picker");
  const { title, subtitle } = patientAuthHeading(view);

  return (
    <>
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo size={22} />
        <div>
          <h1 className="text-[24px]">{title}</h1>
          <p className="mt-1 text-[15px] text-ink-soft">{subtitle}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <PatientLoginForm redirectTo={redirectTo} onViewChange={setView} />
      </div>
    </>
  );
}
