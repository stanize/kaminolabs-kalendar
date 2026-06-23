"use client";

import { useState } from "react";

export function StepCuenta() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continuarConGoogle() {
    setError(null);
    setCargando(true);

    try {
      // Build the OAuth URL manually through our proxied /auth/v1 endpoint.
      // This makes Google show kalendar.kaminolabs.dev on the consent screen
      // instead of the raw Supabase project URL.
      const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
      const params = new URLSearchParams({
        provider: "google",
        redirect_to: redirectTo,
      });

      // Hit our Next.js rewrite proxy instead of Supabase directly
      const res = await fetch(`/auth/v1/authorize?${params.toString()}`);

      if (!res.ok) throw new Error("authorize failed");

      // The response is a redirect — follow it
      window.location.href = res.url;
    } catch {
      setError("No se pudo conectar con Google. Inténtalo de nuevo.");
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={continuarConGoogle}
        disabled={cargando}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-3.5 text-[15px] font-semibold text-ink shadow-sm transition-all duration-150 hover:border-brand-line hover:shadow-md disabled:cursor-wait disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </svg>
        {cargando ? "Conectando…" : "Continuar con Google"}
      </button>

      {error && <p className="text-[13px] font-medium text-error">{error}</p>}

      <p className="m-0 text-center text-[12px] leading-[1.5] text-ink-soft">
        Al continuar aceptas los{" "}
        <a href="#" className="underline hover:text-ink">términos</a>{" "}
        y la{" "}
        <a href="#" className="underline hover:text-ink">política de privacidad</a>{" "}
        de Kalendar.
      </p>
    </div>
  );
}
