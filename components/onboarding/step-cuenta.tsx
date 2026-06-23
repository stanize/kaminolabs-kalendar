"use client";

import { useState } from "react";
import { Field, inputClasses } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { EMAIL_RE } from "@/lib/onboarding/validation";

export function StepCuenta() {
  const d = useOnboardingStore((s) => s.d);
  const setNombre = useOnboardingStore((s) => s.setNombre);
  const setEmail = useOnboardingStore((s) => s.setEmail);
  const setPassword = useOnboardingStore((s) => s.setPassword);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [errorGoogle, setErrorGoogle] = useState<string | null>(null);

  const emailTocado = d.account.email.length > 0;
  const emailOk = EMAIL_RE.test(d.account.email.trim());

  async function continuarConGoogle() {
    setErrorGoogle(null);
    setCargandoGoogle(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    if (error) {
      setErrorGoogle("No se pudo conectar con Google. Inténtalo de nuevo.");
      setCargandoGoogle(false);
    }
    // En éxito, el navegador redirige a Google — no hay nada más que hacer aquí.
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={continuarConGoogle}
        disabled={cargandoGoogle}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface p-[13px] text-[15px] font-semibold text-ink transition-all duration-150 hover:border-brand-line hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
      >
        <span className="font-sans text-[17px] font-extrabold text-[#4285F4]">G</span>
        {cargandoGoogle ? "Conectando…" : "Continuar con Google"}
      </button>

      {errorGoogle && <p className="text-[13px] font-medium text-error">{errorGoogle}</p>}

      <div className="flex items-center text-[13px] text-ink-soft before:mr-3 before:h-px before:flex-1 before:bg-line after:ml-3 after:h-px after:flex-1 after:bg-line">
        o con tu correo
      </div>

      <Field
        label="Tu nombre"
        placeholder="Marta Ruiz"
        value={d.account.nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoComplete="name"
      />
      <Field
        label="Correo electrónico"
        type="email"
        placeholder="marta@email.com"
        value={d.account.email}
        onChange={(e) => setEmail(e.target.value)}
        error={emailTocado && !emailOk}
        autoComplete="email"
      />
      <label className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">Contraseña</span>
        <input
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={d.account.password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className={inputClasses()}
        />
      </label>

      <p className="m-0 text-[12px] leading-[1.45] text-ink-soft">
        Al continuar aceptas los términos y la política de privacidad de Kalendar.
      </p>
    </div>
  );
}
