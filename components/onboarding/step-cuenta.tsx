"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { Icon } from "@/components/ui/icon";

type View = "picker" | "register" | "login";

/** Wraps a promise with a hard timeout */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Sin respuesta del servidor (${ms / 1000}s). Inténtalo de nuevo.`)), ms)
    ),
  ]);
}

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

// ─── Picker view ─────────────────────────────────────────────────────────────

function PickerView({ onGoogle, onEmail }: { onGoogle: () => void; onEmail: () => void }) {
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function handleGoogle() {
    setLoadingGoogle(true);
    await onGoogle();
    setLoadingGoogle(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loadingGoogle}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-4 text-[15px] font-semibold text-ink shadow-sm transition-all duration-150 hover:border-brand-line hover:shadow-md disabled:cursor-wait disabled:opacity-60"
      >
        <GoogleIcon />
        {loadingGoogle ? "Conectando…" : "Continuar con Google"}
      </button>

      <button
        type="button"
        onClick={onEmail}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-4 text-[15px] font-semibold text-ink shadow-sm transition-all duration-150 hover:border-brand-line hover:shadow-md"
      >
        <Icon name="mail" size={20} className="shrink-0 text-ink-soft" />
        Continuar con email
      </button>

      <p className="m-0 mt-1 text-center text-[12px] leading-[1.5] text-ink-soft">
        Al continuar aceptas los{" "}
        <a href="#" className="underline hover:text-ink">términos</a>{" "}
        y la{" "}
        <a href="#" className="underline hover:text-ink">política de privacidad</a>{" "}
        de Kalendar.
      </p>
    </div>
  );
}

// ─── Email form view ──────────────────────────────────────────────────────────

function EmailFormView({
  mode,
  onSuccess,
  onBack,
  onSwitchMode,
}: {
  mode: "register" | "login";
  onSuccess: (name: string, email: string) => void;
  onBack: () => void;
  onSwitchMode: () => void;
}) {
  const [name, setName]                       = useState("");
  const [email, setEmail]                     = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    if (mode === "register") {
      if (!name.trim())                 { setError("Introduce tu nombre."); return; }
      if (!email.trim())                { setError("Introduce tu email."); return; }
      if (password.length < 8)         { setError("La contraseña debe tener al menos 8 caracteres."); return; }
      if (password !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
    } else {
      if (!email.trim() || !password.trim()) { setError("Por favor rellena todos los campos."); return; }
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const result = await withTimeout(
          authClient.signUp.email({ name: name.trim(), email: email.trim(), password }),
          12000
        );
        if (result.error) {
          const msg = result.error.message ?? "";
          setError(
            msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exist")
              ? "Ya existe una cuenta con ese email."
              : `Error: ${msg || "inténtalo de nuevo."}`
          );
          setLoading(false);
          return;
        }
        if (!result.data?.user) {
          setError("Cuenta creada pero sin sesión. Por favor inicia sesión.");
          setLoading(false);
          return;
        }
        onSuccess(name.trim(), email.trim());
      } else {
        const result = await withTimeout(
          authClient.signIn.email({ email: email.trim(), password }),
          12000
        );
        if (result.error || !result.data?.user) {
          setError(`Email o contraseña incorrectos.${result.error?.message ? ` (${result.error.message})` : ""}`);
          setLoading(false);
          return;
        }
        onSuccess(result.data.user.name ?? email.trim(), email.trim());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-line bg-surface px-4 py-3 text-[14px] text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none disabled:opacity-50";

  return (
    <div className="flex flex-col gap-4">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="flex items-center gap-1.5 self-start text-[13.5px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
      >
        <Icon name="chevronLeft" size={16} /> Volver
      </button>

      <div className="flex flex-col gap-3">
        {mode === "register" && (
          <input type="text" placeholder="Tu nombre" value={name}
            onChange={(e) => setName(e.target.value)} disabled={loading} className={inputClass} />
        )}
        <input type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} disabled={loading} className={inputClass} />
        <input type="password" placeholder="Contraseña (mín. 8 caracteres)" value={password}
          onChange={(e) => setPassword(e.target.value)} disabled={loading}
          onKeyDown={(e) => mode === "login" && e.key === "Enter" && handleSubmit()}
          className={inputClass} />
        {mode === "register" && (
          <input type="password" placeholder="Repite la contraseña" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className={inputClass} />
        )}

        <button type="button" onClick={handleSubmit} disabled={loading}
          className="w-full rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60">
          {loading ? "Un momento…" : mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
        </button>
      </div>

      <p className="text-center text-[13px] text-ink-soft">
        {mode === "register" ? (
          <>¿Ya tienes cuenta?{" "}<button type="button" onClick={onSwitchMode} className="font-medium text-brand hover:underline">Iniciar sesión</button></>
        ) : (
          <>¿No tienes cuenta?{" "}<button type="button" onClick={onSwitchMode} className="font-medium text-brand hover:underline">Crear una</button></>
        )}
      </p>

      {error && <p className="rounded-xl bg-error-weak px-3.5 py-2.5 text-[13px] font-medium text-error">{error}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StepCuenta() {
  const setEmailAuthed = useOnboardingStore((s) => s.setEmailAuthed);
  const [view, setView] = useState<View>("picker");

  async function handleGoogle() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/onboarding" });
  }

  function handleSuccess(name: string, email: string) {
    setEmailAuthed(name, email);
  }

  if (view === "picker") {
    return (
      <PickerView
        onGoogle={handleGoogle}
        onEmail={() => setView("register")}
      />
    );
  }

  return (
    <EmailFormView
      mode={view === "register" ? "register" : "login"}
      onSuccess={handleSuccess}
      onBack={() => setView("picker")}
      onSwitchMode={() => setView(view === "register" ? "login" : "register")}
    />
  );
}
