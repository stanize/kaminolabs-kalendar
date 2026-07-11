"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, navigateWithFallback } from "@/lib/auth-client";
import { Icon } from "@/components/ui/icon";
import { provisionPatient, checkPatientRoleConflict } from "@/lib/actions/patient";

type View = "picker" | "login" | "register" | "roleConfirm";

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
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

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-[14px] text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none disabled:opacity-50";

interface PatientLoginFormProps {
  // Redirect destination after successful auth + provisioning.
  // Defaults to /patient. The booking wizard passes its own callback.
  redirectTo?: string;
  // Labels — these come from the patient login page (Spanish/English
  // depending on context). Kept simple for now; full i18n pass later.
  labels?: Partial<PatientLabels>;
}

interface PatientLabels {
  title: string;
  subtitle: string;
  continueGoogle: string;
  continueEmail: string;
  back: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  namePlaceholder: string;
  confirmPasswordPlaceholder: string;
  signIn: string;
  loggingIn: string;
  createAccount: string;
  creating: string;
  connecting: string;
  noAccount: string;
  haveAccount: string;
  switchToRegister: string;
  switchToLogin: string;
  errName: string;
  errEmail: string;
  errPasswordLength: string;
  errPasswordMismatch: string;
  errEmptyFields: string;
  errBadCredentials: string;
  errGoogle: string;
  errTimeout: string;
  errGeneric: string;
  errEmailExists: string;
  errUnexpected: string;
  roleConfirmTitle: string;
  roleConfirmBody: string;
  roleConfirmYes: string;
  roleConfirmNo: string;
}

const DEFAULT_LABELS: PatientLabels = {
  title: "Accede a tu cuenta",
  subtitle: "Para continuar con tu reserva",
  continueGoogle: "Continuar con Google",
  continueEmail: "Continuar con email",
  back: "Atrás",
  emailPlaceholder: "Email",
  passwordPlaceholder: "Contraseña",
  namePlaceholder: "Nombre y apellido",
  confirmPasswordPlaceholder: "Confirmar contraseña",
  signIn: "Iniciar sesión",
  loggingIn: "Accediendo…",
  createAccount: "Crear cuenta",
  creating: "Creando cuenta…",
  connecting: "Conectando…",
  noAccount: "¿No tienes cuenta?",
  haveAccount: "¿Ya tienes cuenta?",
  switchToRegister: "Crear una",
  switchToLogin: "Inicia sesión",
  errName: "Indica tu nombre.",
  errEmail: "Indica un email válido.",
  errPasswordLength: "La contraseña debe tener al menos 8 caracteres.",
  errPasswordMismatch: "Las contraseñas no coinciden.",
  errEmptyFields: "Rellena todos los campos.",
  errBadCredentials: "Email o contraseña incorrectos.",
  errGoogle: "No se pudo conectar con Google. Inténtalo de nuevo.",
  errTimeout: "La conexión tardó demasiado. Inténtalo de nuevo.",
  errGeneric: "Ocurrió un error. Inténtalo de nuevo.",
  errEmailExists: "Ya existe una cuenta con ese email.",
  errUnexpected: "Error inesperado. Inténtalo de nuevo.",
  roleConfirmTitle: "Un momento",
  roleConfirmBody: "Esta cuenta ya existe con otro tipo de acceso. Continuar añadirá el rol de paciente a tu cuenta. ¿Quieres continuar?",
  roleConfirmYes: "Sí, continuar",
  roleConfirmNo: "No, cancelar",
};

export function PatientLoginForm({ redirectTo = "/patient", labels }: PatientLoginFormProps) {
  const router = useRouter();
  const L = { ...DEFAULT_LABELS, ...labels };

  const [view, setView] = useState<View>("picker");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After any successful auth, check for a cross-role conflict before
  // silently adding the patient role, then provision + redirect.
  async function completeProvision() {
    setLoading(true);
    const result = await provisionPatient();
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    navigateWithFallback(router, redirectTo);
  }

  async function afterAuth() {
    const conflict = await checkPatientRoleConflict();
    if (conflict.needsConfirm) {
      setLoading(false);
      setView("roleConfirm");
      return;
    }
    await completeProvision();
  }

  async function declineRoleAdd() {
    setLoading(true);
    await authClient.signOut();
    setLoading(false);
    setError(null);
    setView("picker");
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      // Google OAuth redirects back via the callbackURL; provisioning happens
      // in the /patient layout on the server side after the redirect lands.
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectTo,
      });
    } catch {
      setError(L.errGoogle);
      setLoading(false);
    }
  }

  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password.trim()) { setError(L.errEmptyFields); return; }
    setLoading(true);
    try {
      const result = await withTimeout(
        authClient.signIn.email({ email: email.trim(), password }),
        12000,
        L.errTimeout
      );
      if (result.error || !result.data?.user) {
        setError(L.errBadCredentials);
        setLoading(false);
        return;
      }
      await afterAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : L.errUnexpected);
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError(null);
    if (!name.trim())                 { setError(L.errName); return; }
    if (!email.trim())                { setError(L.errEmail); return; }
    if (password.length < 8)          { setError(L.errPasswordLength); return; }
    if (password !== confirmPassword) { setError(L.errPasswordMismatch); return; }
    setLoading(true);
    try {
      const result = await withTimeout(
        authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: redirectTo,
        }),
        12000,
        L.errTimeout
      );
      if (result.error) {
        const msg = (result.error.message ?? "").toLowerCase();
        setError(
          msg.includes("already") || msg.includes("exist")
            ? L.errEmailExists
            : L.errGeneric
        );
        setLoading(false);
        return;
      }
      await afterAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : L.errUnexpected);
      setLoading(false);
    }
  }

  if (view === "roleConfirm") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-[16px] font-semibold text-ink">{L.roleConfirmTitle}</h2>
        <p className="text-[14px] text-ink-soft">{L.roleConfirmBody}</p>
        <button type="button" onClick={completeProvision} disabled={loading}
          className="w-full rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60">
          {L.roleConfirmYes}
        </button>
        <button type="button" onClick={declineRoleAdd} disabled={loading}
          className="w-full rounded-xl border border-line bg-surface px-5 py-3.5 text-[15px] font-semibold text-ink transition-all hover:border-brand-line disabled:cursor-wait disabled:opacity-60">
          {L.roleConfirmNo}
        </button>
        {error && (
          <p className="rounded-xl bg-error-weak px-3.5 py-2.5 text-[13px] font-medium text-error">{error}</p>
        )}
      </div>
    );
  }

  if (view === "picker") {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-4 text-[15px] font-semibold text-ink shadow-sm transition-all hover:border-brand-line hover:shadow-md disabled:cursor-wait disabled:opacity-60"
        >
          <GoogleIcon />
          {loading ? L.connecting : L.continueGoogle}
        </button>

        <button
          type="button"
          onClick={() => { setError(null); setView("login"); }}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-4 text-[15px] font-semibold text-ink shadow-sm transition-all hover:border-brand-line hover:shadow-md"
        >
          <Icon name="mail" size={20} className="shrink-0 text-ink-soft" />
          {L.continueEmail}
        </button>

        {error && (
          <p className="rounded-xl bg-error-weak px-3.5 py-2.5 text-[13px] font-medium text-error">{error}</p>
        )}

        <p className="text-center text-[13px] text-ink-soft">
          {L.noAccount}{" "}
          <button type="button" onClick={() => { setError(null); setView("register"); }}
            className="font-medium text-brand hover:underline">
            {L.switchToRegister}
          </button>
        </p>
      </div>
    );
  }

  if (view === "login") {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => { setView("picker"); setError(null); }}
          disabled={loading}
          className="flex items-center gap-1.5 self-start text-[13.5px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
        >
          <Icon name="chevronLeft" size={16} /> {L.back}
        </button>

        <div className="flex flex-col gap-3">
          <input type="email" placeholder={L.emailPlaceholder} value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={loading} className={inputClass} />
          <input type="password" placeholder={L.passwordPlaceholder} value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()} className={inputClass} />
          <button type="button" onClick={handleLogin} disabled={loading}
            className="w-full rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60">
            {loading ? L.loggingIn : L.signIn}
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-error-weak px-3.5 py-2.5 text-[13px] font-medium text-error">{error}</p>
        )}

        <p className="text-center text-[13px] text-ink-soft">
          {L.noAccount}{" "}
          <button type="button" onClick={() => { setView("register"); setError(null); }}
            className="font-medium text-brand hover:underline">
            {L.switchToRegister}
          </button>
        </p>
      </div>
    );
  }

  // register view
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => { setView("picker"); setError(null); }}
        disabled={loading}
        className="flex items-center gap-1.5 self-start text-[13.5px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
      >
        <Icon name="chevronLeft" size={16} /> {L.back}
      </button>

      <div className="flex flex-col gap-3">
        <input type="text" placeholder={L.namePlaceholder} value={name}
          onChange={(e) => setName(e.target.value)} disabled={loading} className={inputClass} />
        <input type="email" placeholder={L.emailPlaceholder} value={email}
          onChange={(e) => setEmail(e.target.value)} disabled={loading} className={inputClass} />
        <input type="password" placeholder={L.passwordPlaceholder} value={password}
          onChange={(e) => setPassword(e.target.value)} disabled={loading} className={inputClass} />
        <input type="password" placeholder={L.confirmPasswordPlaceholder} value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading}
          onKeyDown={(e) => e.key === "Enter" && handleRegister()} className={inputClass} />
        <button type="button" onClick={handleRegister} disabled={loading}
          className="w-full rounded-xl bg-brand px-5 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60">
          {loading ? L.creating : L.createAccount}
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-error-weak px-3.5 py-2.5 text-[13px] font-medium text-error">{error}</p>
      )}

      <p className="text-center text-[13px] text-ink-soft">
        {L.haveAccount}{" "}
        <button type="button" onClick={() => { setView("login"); setError(null); }}
          className="font-medium text-brand hover:underline">
          {L.switchToLogin}
        </button>
      </p>
    </div>
  );
}
