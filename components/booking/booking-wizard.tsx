"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { Btn } from "@/components/ui/button";
import { getAvailableSlots, submitBooking, type SlotDTO } from "@/lib/actions/booking";
import { provisionPatient, checkPatientRoleConflict } from "@/lib/actions/patient";
import { authClient } from "@/lib/auth-client";
import type { DayId } from "@/lib/onboarding/types";
import type { Locale } from "@/lib/i18n/config";
import { getBookingPageDictionary, type BookingPageDictionary } from "@/lib/i18n/dictionaries/booking-page";
import type { PatientInfo } from "@/components/booking/booking-page-shell";

interface Service { id: string; name: string; duration_min: number; price: number; }
interface Member  { id: string; name: string; role: string | null; }

function priceLabel(p: number, freeLabel: string): string {
  return p === 0 ? freeLabel : `${p} €`;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function jsDowToDayId(dow: number): DayId {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as DayId[])[dow];
}

function groupByProvider(slots: SlotDTO[]): { providerId: string | null; providerName: string | null; slots: SlotDTO[] }[] {
  const groups: { providerId: string | null; providerName: string | null; slots: SlotDTO[] }[] = [];
  for (const s of slots) {
    let g = groups.find((x) => x.providerId === s.providerId);
    if (!g) { g = { providerId: s.providerId, providerName: s.providerName, slots: [] }; groups.push(g); }
    g.slots.push(s);
  }
  for (const g of groups) g.slots.sort((a, b) => a.startIso.localeCompare(b.startIso));
  groups.sort((a, b) => (a.providerName ?? "").localeCompare(b.providerName ?? ""));
  return groups;
}

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), ms))]);
}

const inputBase = "w-full rounded-xl border border-line bg-surface px-4 py-3 text-[14px] text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none disabled:opacity-50";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

export function BookingWizard({
  slug, services, members, openDays, bookingWindowMonths, isTeam, locale, patient, onPatientChange,
}: {
  slug: string; services: Service[]; members: Member[]; openDays: DayId[];
  bookingWindowMonths: number; isTeam: boolean; locale: Locale;
  patient: PatientInfo | null;
  onPatientChange: (p: PatientInfo | null) => void;
}) {
  type Step = "service" | "provider" | "date" | "done";
  const [step, setStep] = useState<Step>("service");

  const dict = getBookingPageDictionary(locale);
  const w = dict.wizard;

  const [service, setService] = useState<Service | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneAsGuest, setDoneAsGuest] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function reset() {
    setStep("service"); setService(null); setProviderId(null);
    setSlot(null); setError(null); setConfirmOpen(false);
  }

  function chooseService(s: Service) {
    setService(s); setError(null);
    setStep(isTeam ? "provider" : "date");
  }

  function chooseProvider(id: string | null) {
    setProviderId(id); setError(null); setStep("date");
  }

  function backStep() {
    setError(null);
    if (step === "provider") setStep("service");
    else if (step === "date") setStep(isTeam ? "provider" : "service");
  }

  const showBack = step !== "service" && step !== "done";

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_12px_40px_rgba(15,31,46,.06)]">
      {showBack && (
        <button onClick={backStep} className="mb-4 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink">
          <Icon name="chevronLeft" size={15} /> {w.back}
        </button>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {step === "service" && (
        <Section title={w.chooseService}>
          <div className="flex flex-col gap-2">
            {services.length === 0 && <p className="text-[14px] text-ink-soft">{w.noServices}</p>}
            {services.map((s) => (
              <button key={s.id} onClick={() => chooseService(s)}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3.5 text-left transition-all hover:border-brand-line hover:bg-brand-weak">
                <span>
                  <span className="block text-[14.5px] font-semibold text-ink">{s.name}</span>
                  <span className="block text-[12.5px] text-ink-soft">{s.duration_min} {w.minutesUnit} · {priceLabel(s.price, w.freeLabel)}</span>
                </span>
                <Icon name="chevronRight" size={16} className="text-ink-soft" />
              </button>
            ))}
          </div>
        </Section>
      )}

      {step === "provider" && (
        <Section title={w.chooseProvider}>
          <div className="flex flex-col gap-2">
            <ProviderButton label={w.anyProvider} sub={w.anyProviderSub} onClick={() => chooseProvider(null)} />
            {members.map((m) => (
              <ProviderButton key={m.id} label={m.name} sub={m.role ?? undefined} onClick={() => chooseProvider(m.id)} />
            ))}
          </div>
        </Section>
      )}

      {step === "date" && service && (
        <DateTimeStep slug={slug} serviceId={service.id} providerId={providerId}
          openDays={openDays} bookingWindowMonths={bookingWindowMonths} dict={dict}
          onError={setError}
          onPick={(_d, s) => { setSlot(s); setError(null); setConfirmOpen(true); }}
        />
      )}

      {step === "done" && (
        <div className="py-4 text-center">
          <div className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full ${doneAsGuest ? "bg-surface-2 text-ink-soft" : "bg-brand-weak text-brand"}`}>
            {doneAsGuest
              ? <Icon name="mail" size={24} />
              : <Icon name="check" size={26} strokeWidth={2.5} />}
          </div>
          <h2 className="mb-1.5 text-[20px]">
            {doneAsGuest ? w.doneTitleGuest : w.doneTitle}
          </h2>
          <p className="mx-auto mb-6 max-w-[360px] text-[14px] text-ink-soft">
            {doneAsGuest ? w.doneBodyGuest : w.doneBody}
          </p>
          <Btn variant="outline" onClick={reset}>{w.bookAnother}</Btn>
        </div>
      )}

      {confirmOpen && service && slot && (
        <ConfirmAuthModal
          slug={slug} serviceId={service.id} slot={slot} serviceName={service.name}
          locale={locale} dict={dict} patient={patient}
          onPatientChange={onPatientChange}
          onError={setError}
          onClose={() => setConfirmOpen(false)}
          onDone={(asGuest) => { setConfirmOpen(false); setDoneAsGuest(asGuest); setStep("done"); }}
        />
      )}
    </div>
  );
}

// ── Confirm / auth modal ────────────────────────────────────────────────────
// Shown as an overlay when the guest picks a slot (browsing stays free — this
// only appears at the point of confirming an appointment, IKEA-checkout style):
// "Join Kalendar or sign in" vs "Continue as guest".
function ConfirmAuthModal({
  slug, serviceId, slot, serviceName, locale, dict, patient,
  onPatientChange, onError, onClose, onDone,
}: {
  slug: string; serviceId: string; slot: SlotDTO; serviceName: string;
  locale: Locale; dict: BookingPageDictionary;
  patient: PatientInfo | null;
  onPatientChange: (p: PatientInfo | null) => void;
  onError: (e: string | null) => void;
  onClose: () => void;
  onDone: (asGuest: boolean) => void;
}) {
  const am = dict.authModal;
  const af = dict.authForm;
  const w = dict.wizard;
  type AuthView = "start" | "login" | "register" | "guest" | "roleConfirm";
  const [view, setView] = useState<AuthView>("start");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [name, setName]                 = useState("");
  const [confirmPassword, setConfirm]   = useState("");
  const [guestPhone, setGuestPhone]     = useState("");
  const [busy, setBusy]                 = useState(false);
  const [localError, setLocalError]     = useState<string | null>(null);

  // If already authenticated, submit directly.
  async function submitAuthenticated(p: PatientInfo) {
    setBusy(true);
    onError(null);
    const res = await submitBooking({
      slug, serviceId, providerId: slot.providerId,
      startIso: slot.startIso,
      clientName: p.name, clientEmail: p.email, clientPhone: "",
      guestLocale: locale, patientId: p.id,
    });
    setBusy(false);
    if (!res.ok) { onError(res.error); return; }
    onDone(false); // authenticated — not a guest
  }

  async function completeProvision() {
    setBusy(true);
    setLocalError(null);
    const result = await provisionPatient();
    if (!result.ok) { setLocalError(result.error); setBusy(false); return; }
    // Get the user's name/email from the session.
    const sessionData = await authClient.getSession();
    const user = sessionData?.data?.user;
    if (!user) { setLocalError("No se pudo obtener la sesión."); setBusy(false); return; }
    const p: PatientInfo = { id: result.patientId, name: user.name ?? "", email: user.email ?? "" };
    onPatientChange(p);
    await submitAuthenticated(p);
  }

  async function afterAuth() {
    setBusy(true);
    setLocalError(null);
    const conflict = await checkPatientRoleConflict();
    if (conflict.needsConfirm) {
      // This account already holds a different role (e.g. clinic) — don't
      // silently add "patient" to it. Ask first.
      setBusy(false);
      setView("roleConfirm");
      return;
    }
    await completeProvision();
  }

  async function declineRoleAdd() {
    setBusy(true);
    await authClient.signOut();
    onPatientChange(null);
    setBusy(false);
    setLocalError(null);
    setView("start");
  }

  async function handleGoogle() {
    setLocalError(null);
    setBusy(true);
    try {
      // Google OAuth redirects away — we can't easily do inline here.
      // Redirect back to this page; the patient session will be detected
      // server-side on reload and the wizard will auto-show as authenticated.
      await authClient.signIn.social({ provider: "google", callbackURL: window.location.href });
    } catch {
      setLocalError("No se pudo conectar con Google.");
      setBusy(false);
    }
  }

  async function handleLogin() {
    setLocalError(null);
    if (!email.trim() || !password.trim()) { setLocalError("Rellena todos los campos."); return; }
    setBusy(true);
    try {
      const result = await withTimeout(authClient.signIn.email({ email: email.trim(), password }), 12000, "Tiempo agotado.");
      if (result.error || !result.data?.user) { setLocalError("Email o contraseña incorrectos."); setBusy(false); return; }
      await afterAuth();
    } catch (e) { setLocalError(e instanceof Error ? e.message : "Error inesperado."); setBusy(false); }
  }

  async function handleRegister() {
    setLocalError(null);
    if (!name.trim()) { setLocalError("Indica tu nombre."); return; }
    if (!email.trim()) { setLocalError("Indica un email válido."); return; }
    if (password.length < 8) { setLocalError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirmPassword) { setLocalError("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const result = await withTimeout(
        authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: window.location.href }),
        12000, "Tiempo agotado."
      );
      if (result.error) {
        const msg = (result.error.message ?? "").toLowerCase();
        setLocalError(msg.includes("already") || msg.includes("exist") ? "Ya existe una cuenta con ese email." : "Ocurrió un error. Inténtalo de nuevo.");
        setBusy(false); return;
      }
      await afterAuth();
    } catch (e) { setLocalError(e instanceof Error ? e.message : "Error inesperado."); setBusy(false); }
  }

  async function submitGuest() {
    setLocalError(null);
    onError(null);
    if (name.trim().length < 2) { setLocalError(w.errNameRequired); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setLocalError(w.errEmailInvalid); return; }
    setBusy(true);
    const res = await submitBooking({
      slug, serviceId, providerId: slot.providerId, startIso: slot.startIso,
      clientName: name, clientEmail: email, clientPhone: guestPhone,
      guestLocale: locale,
      // No patientId — this is the guest path.
    });
    setBusy(false);
    if (!res.ok) { setLocalError(res.error); return; }
    onDone(true);
  }

  function handleClose() {
    if (busy) return;
    onClose();
  }

  // Slot summary shown at the top of the modal.
  const slotSummary = (
    <div className="mb-5 rounded-xl bg-surface-2 px-4 py-3 text-[13.5px] text-ink">
      <span className="font-semibold">{serviceName}</span> · {slot.label}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-[420px] rounded-2xl bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label={am.close}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="x" size={18} />
        </button>

        {/* Already authenticated — show confirm button. */}
        {patient ? (
          <Section title={am.confirmTitle}>
            {slotSummary}
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-weak px-4 py-3 text-[13.5px] text-brand-ink">
              <Icon name="user" size={15} className="shrink-0" />
              <span>{patient.name || patient.email}</span>
            </div>
            <Btn onClick={() => submitAuthenticated(patient)} disabled={busy} size="lg" full>
              {busy ? am.confirming : am.confirmButton}
            </Btn>
            {localError && <p className="mt-3 text-[13px] text-error">{localError}</p>}
          </Section>
        ) : view === "start" ? (
          <Section title={am.title}>
            <p className="mb-3 text-[16px] font-bold text-ink">{am.advantagesHeading}</p>
            <ul className="mb-5 flex flex-col gap-2">
              {[am.perk1, am.perk2, am.perk3].map((perk) => (
                <li key={perk} className="flex items-center gap-2 text-[13.5px] text-ink-soft">
                  <Icon name="check" size={14} className="shrink-0 text-brand" />
                  {perk}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setView("register")} disabled={busy}
                className="w-full rounded-xl bg-brand px-4 py-3.5 text-[14.5px] font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-60">
                {am.registerButton}
              </button>
              <button type="button" onClick={() => setView("login")} disabled={busy}
                className="w-full rounded-xl border border-brand-line px-4 py-3.5 text-[14.5px] font-semibold text-brand transition-all hover:bg-brand-weak">
                {am.signInButton}
              </button>
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[12px] text-ink-soft">{am.or}</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <button type="button" onClick={() => { setLocalError(null); setView("guest"); }} disabled={busy}
              className="w-full rounded-xl border border-line px-4 py-3.5 text-[14.5px] font-semibold text-ink transition-all hover:border-brand-line hover:bg-brand-weak">
              {am.continueAsGuest}
            </button>
            <p className="mt-2 text-center text-[12px] text-ink-soft">{am.guestNote}</p>

            {localError && <p className="mt-3 text-[13px] text-error">{localError}</p>}
          </Section>
        ) : view === "login" ? (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Logo showText={false} size={18} />
              <h2 className="text-[16px] font-semibold text-ink">{af.loginTitle}</h2>
            </div>
            <div className="flex flex-col gap-3">
              <input type="email" placeholder={af.emailPlaceholder} value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={busy} className={`${inputBase} rounded-full`} />
              <input type="password" placeholder={af.passwordPlaceholder} value={password}
                onChange={(e) => setPassword(e.target.value)} disabled={busy}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()} className={`${inputBase} rounded-full`} />
              <button type="button" onClick={handleLogin} disabled={busy}
                className="w-full rounded-full bg-brand px-4 py-3.5 text-[14.5px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60">
                {busy ? af.signingIn : af.signIn}
              </button>
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[12px] text-ink-soft">{af.or}</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <button type="button" onClick={handleGoogle} disabled={busy}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-surface px-4 py-3.5 text-[14.5px] font-semibold text-ink shadow-sm transition-all hover:border-brand-line hover:shadow-md disabled:opacity-60">
              <GoogleIcon /> {af.continueGoogle}
            </button>

            {localError && <p className="mt-3 text-[13px] text-error">{localError}</p>}

            <p className="mt-4 text-center text-[13px] text-ink-soft">
              {af.noAccount}{" "}
              <button type="button" onClick={() => { setView("register"); setLocalError(null); }}
                className="font-medium text-brand hover:underline">
                {af.createFreeLink}
              </button>
            </p>
          </div>
        ) : view === "roleConfirm" ? (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Logo showText={false} size={18} />
              <h2 className="text-[16px] font-semibold text-ink">{am.roleConfirmTitle}</h2>
            </div>
            <p className="mb-5 text-[14px] text-ink-soft">{am.roleConfirmBody}</p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={completeProvision} disabled={busy}
                className="w-full rounded-full bg-brand px-4 py-3.5 text-[14.5px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60">
                {busy ? am.confirming : am.roleConfirmYes}
              </button>
              <button type="button" onClick={declineRoleAdd} disabled={busy}
                className="w-full rounded-full border border-line px-4 py-3.5 text-[14.5px] font-semibold text-ink transition-all hover:border-brand-line hover:bg-brand-weak">
                {am.roleConfirmNo}
              </button>
            </div>
            {localError && <p className="mt-3 text-[13px] text-error">{localError}</p>}
          </div>
        ) : view === "guest" ? (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Logo showText={false} size={18} />
              <h2 className="text-[16px] font-semibold text-ink">{w.yourDetails}</h2>
            </div>
            <div className="flex flex-col gap-3">
              <input placeholder={w.namePlaceholder} value={name}
                onChange={(e) => setName(e.target.value)} disabled={busy} maxLength={80}
                className={`${inputBase} rounded-full`} />
              <input placeholder={w.emailPlaceholder} type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={busy} maxLength={120}
                className={`${inputBase} rounded-full`} />
              <input placeholder={w.phonePlaceholder} value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)} disabled={busy} maxLength={30}
                className={`${inputBase} rounded-full`} />
            </div>
            <p className="mt-3 text-center text-[12px] text-ink-soft">{am.guestNote}</p>
            <button type="button" onClick={submitGuest} disabled={busy}
              className="mt-3 w-full rounded-full bg-brand px-4 py-3.5 text-[14.5px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60">
              {busy ? w.booking : w.bookButton}
            </button>
            {localError && <p className="mt-3 text-[13px] text-error">{localError}</p>}
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Logo showText={false} size={18} />
              <h2 className="text-[16px] font-semibold text-ink">{af.registerTitle}</h2>
            </div>
            <button type="button" onClick={handleGoogle} disabled={busy}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-surface px-4 py-3.5 text-[14.5px] font-semibold text-ink shadow-sm transition-all hover:border-brand-line hover:shadow-md disabled:opacity-60">
              <GoogleIcon /> {af.continueGoogle}
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[12px] text-ink-soft">{af.or}</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <div className="flex flex-col gap-3">
              <input type="text" placeholder={af.namePlaceholder} value={name}
                onChange={(e) => setName(e.target.value)} disabled={busy} className={`${inputBase} rounded-full`} />
              <input type="email" placeholder={af.emailPlaceholder} value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={busy} className={`${inputBase} rounded-full`} />
              <input type="password" placeholder={af.passwordPlaceholder} value={password}
                onChange={(e) => setPassword(e.target.value)} disabled={busy} className={`${inputBase} rounded-full`} />
              <input type="password" placeholder={af.confirmPasswordPlaceholder} value={confirmPassword}
                onChange={(e) => setConfirm(e.target.value)} disabled={busy}
                onKeyDown={(e) => e.key === "Enter" && handleRegister()} className={`${inputBase} rounded-full`} />
              <button type="button" onClick={handleRegister} disabled={busy}
                className="w-full rounded-full bg-brand px-4 py-3.5 text-[14.5px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60">
                {busy ? af.creatingAccount : af.createAccount}
              </button>
            </div>

            {localError && <p className="mt-3 text-[13px] text-error">{localError}</p>}

            <p className="mt-3 text-center text-[12px] text-ink-soft">{af.termsNote}</p>

            <p className="mt-3 text-center text-[13px] text-ink-soft">
              {af.haveAccount}{" "}
              <button type="button" onClick={() => { setView("login"); setLocalError(null); }}
                className="font-medium text-brand hover:underline">
                {af.signInLink}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h2 className="mb-4 text-[17px]">{title}</h2>{children}</div>;
}

function ProviderButton({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center justify-between rounded-xl border border-line px-4 py-3.5 text-left transition-all hover:border-brand-line hover:bg-brand-weak">
      <span className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-weak text-brand">
          <Icon name="user" size={17} />
        </span>
        <span>
          <span className="block text-[14.5px] font-semibold text-ink">{label}</span>
          {sub && <span className="block text-[12.5px] text-ink-soft">{sub}</span>}
        </span>
      </span>
      <Icon name="chevronRight" size={16} className="text-ink-soft" />
    </button>
  );
}

function startOfWeekMon(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x;
}

function DateTimeStep({ slug, serviceId, providerId, openDays, bookingWindowMonths, dict, onError, onPick }: {
  slug: string; serviceId: string; providerId: string | null; openDays: DayId[];
  bookingWindowMonths: number; dict: BookingPageDictionary;
  onError: (e: string | null) => void; onPick: (date: string, slot: SlotDTO) => void;
}) {
  const w = dict.wizard;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setMonth(maxDate.getMonth() + bookingWindowMonths);
  const openSet = new Set(openDays);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeekMon(today));
  const [slotsByDate, setSlotsByDate] = useState<Record<string, SlotDTO[]>>({});
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set());

  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  function isSelectable(d: Date) { return d >= today && d <= maxDate && openSet.has(jsDowToDayId(d.getDay())); }

  useEffect(() => {
    let cancelled = false;
    const selectableDays = weekDays.filter(isSelectable);
    onError(null);
    (async () => {
      if (selectableDays.length === 0) {
        setSlotsByDate({});
        setLoadingDates(new Set());
        return;
      }
      setLoadingDates(new Set(selectableDays.map(ymd)));
      const dateFrom = ymd(selectableDays[0]);
      const dateTo = ymd(selectableDays[selectableDays.length - 1]);
      const res = await getAvailableSlots({ slug, serviceId, providerId, dateFrom, dateTo, dict: dict.errors });
      if (cancelled) return;
      if (!res.ok) {
        onError(res.error);
        setSlotsByDate({});
      } else {
        setSlotsByDate(res.slotsByDate);
      }
      setLoadingDates(new Set());
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime(), slug, serviceId, providerId]);

  const thisWeekStart = startOfWeekMon(today);
  const canPrev = weekStart > thisWeekStart;
  const canNext = (() => { const n = new Date(weekStart); n.setDate(n.getDate() + 7); return n <= maxDate; })();
  const isTeamAny = providerId === null;
  const monthLabel = `${dict.months[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  return (
    <Section title={w.chooseDateTime}>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}
          disabled={!canPrev} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2 disabled:opacity-30" aria-label={w.prevWeek}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="text-[14px] font-semibold capitalize text-ink">{monthLabel}</span>
        <button onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}
          disabled={!canNext} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2 disabled:opacity-30" aria-label={w.nextWeek}>
          <Icon name="chevronRight" size={16} />
        </button>
      </div>

      {loadingDates.size > 0 ? (
        <p className="py-6 text-center text-[13.5px] text-ink-soft">{w.searchingSlots}</p>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d, i) => {
            const ds = ymd(d);
            const sel = isSelectable(d);
            const slots = slotsByDate[ds];

            return (
              <div key={i} className="flex min-w-0 flex-col">
                <div className={`mb-1.5 flex flex-col items-center gap-0.5 rounded-lg border py-1.5 ${
                  sel ? "border-line bg-surface text-ink" : "border-transparent text-ink-soft/30"}`}>
                  <span className="text-[9px] font-semibold uppercase">{dict.weekdaysShort[i]}</span>
                  <span className="text-[13px] font-semibold leading-none">{d.getDate()}</span>
                </div>

                <div className="flex max-h-[360px] flex-col gap-1 overflow-y-auto pr-0.5">
                  {!sel && (
                    <p className="pt-2 text-center text-[10px] leading-tight text-ink-soft/60">{w.closed}</p>
                  )}
                  {sel && slots?.length === 0 && (
                    <p className="pt-2 text-center text-[10px] leading-tight text-ink-soft">{w.noSlotsThisDay}</p>
                  )}
                  {sel && slots && slots.length > 0 && (
                    isTeamAny ? (
                      groupByProvider(slots).map((group) => (
                        <div key={group.providerId ?? "any"} className="flex flex-col gap-1">
                          <span className="truncate text-[8.5px] font-bold uppercase tracking-[.02em] text-ink-soft">{group.providerName}</span>
                          {group.slots.map((s) => (
                            <button key={`${s.startIso}-${s.providerId ?? ""}`} onClick={() => onPick(ds, s)}
                              className="rounded-md border border-line px-0.5 py-1 text-[10.5px] font-semibold text-ink transition-all hover:border-brand hover:bg-brand hover:text-white">
                              {s.label}
                            </button>
                          ))}
                        </div>
                      ))
                  ) : (
                    slots.map((s) => (
                      <button key={`${s.startIso}-${s.providerId ?? ""}`} onClick={() => onPick(ds, s)}
                        className="rounded-md border border-line px-0.5 py-1 text-[10.5px] font-semibold text-ink transition-all hover:border-brand hover:bg-brand hover:text-white">
                        {s.label}
                      </button>
                    ))
                  )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
