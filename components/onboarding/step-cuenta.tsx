"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useOnboardingStore } from "@/lib/onboarding/store";

type Modo = "registro" | "login";

export function StepCuenta() {
  const setEmailAuthed = useOnboardingStore((s) => s.setEmailAuthed);

  const [modo, setModo] = useState<Modo>("registro");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [cargandoEmail, setCargandoEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continuarConGoogle() {
    setError(null);
    setCargandoGoogle(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/onboarding",
      });
    } catch {
      setError("No se pudo conectar con Google. Inténtalo de nuevo.");
      setCargandoGoogle(false);
    }
  }

  async function manejarEmail() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Por favor rellena todos los campos.");
      return;
    }
    if (modo === "registro" && !nombre.trim()) {
      setError("Introduce tu nombre.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setCargandoEmail(true);
    try {
      if (modo === "registro") {
        const { error: err } = await authClient.signUp.email({
          name: nombre.trim(),
          email: email.trim(),
          password,
        });
        if (err) {
          setError(
            err.message?.includes("already")
              ? "Ya existe una cuenta con ese email. ¿Quieres iniciar sesión?"
              : "No se pudo crear la cuenta. Inténtalo de nuevo."
          );
          setCargandoEmail(false);
          return;
        }
        setEmailAuthed(nombre.trim(), email.trim());
      } else {
        const { data, error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err || !data?.user) {
          setError("Email o contraseña incorrectos.");
          setCargandoEmail(false);
          return;
        }
        setEmailAuthed(data.user.name ?? email.trim(), email.trim());
      }
    } catch {
      setError("Ha ocurrido un error. Inténtalo de nuevo.");
      setCargandoEmail(false);
    }
  }

  const cargando = cargandoGoogle || cargandoEmail;

  return (
    <div className="flex flex-col gap-4">
      {/* Google */}
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
        {cargandoGoogle ? "Conectando…" : "Continuar con Google"}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[12px] text-ink-soft">o continúa con email</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      {/* Email form */}
      <div className="flex flex-col gap-3">
        {modo === "registro" && (
          <input
            type="text"
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={cargando}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-[14px] text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none disabled:opacity-50"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={cargando}
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-[14px] text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none disabled:opacity-50"
        />
        <input
          type="password"
          placeholder="Contraseña (mín. 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={cargando}
          onKeyDown={(e) => e.key === "Enter" && manejarEmail()}
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-[14px] text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none disabled:opacity-50"
        />

        <button
          type="button"
          onClick={manejarEmail}
          disabled={cargando}
          className="w-full rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60"
        >
          {cargandoEmail
            ? "Un momento…"
            : modo === "registro"
            ? "Crear cuenta"
            : "Iniciar sesión"}
        </button>
      </div>

      {/* Toggle modo */}
      <p className="text-center text-[13px] text-ink-soft">
        {modo === "registro" ? (
          <>
            ¿Ya tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => { setModo("login"); setError(null); }}
              className="font-medium text-brand hover:underline"
            >
              Iniciar sesión
            </button>
          </>
        ) : (
          <>
            ¿No tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => { setModo("registro"); setError(null); }}
              className="font-medium text-brand hover:underline"
            >
              Crear una
            </button>
          </>
        )}
      </p>

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
