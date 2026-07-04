"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { getAvailableSlots, submitBooking, type SlotDTO } from "@/lib/actions/booking";
import { provisionPatient } from "@/lib/actions/patient";
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
  type Step = "service" | "provider" | "date" | "auth" | "details" | "done";
  const [step, setStep] = useState<Step>("service");

  const dict = getBookingPageDictionary(locale);
  const w = dict.wizard;

  const [service, setService] = useState<Service | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneAsGuest, setDoneAsGuest] = useState(false);

  function reset() {
    setStep("service"); setService(null); setProviderId(null);
    setDate(null); setSlot(null); setError(null);
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
    else if (step === "auth") setStep("date");
    else if (step === "details") setStep("auth");
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
          onPick={(d, s) => { setDate(d); setSlot(s); setError(null); setStep("auth"); }}
        />
      )}

      {step === "auth" && service && slot && (
        <AuthGateStep
          slug={slug} serviceId={service.id} slot={slot} serviceName={service.name}
          locale={locale} patient={patient}
          onPatientChange={onPatientChange}
          onError={setError}
          onContinueAsGuest={() => { setError(null); setStep("details"); }}
          onDone={(asGuest) => { setDoneAsGuest(asGuest); setStep("done"); }}
        />
      )}

      {step === "details" && service && slot && date && (
        <DetailsStep slug={slug} serviceId={service.id} providerId={slot.providerId}
          slot={slot} serviceName={service.name} dict={dict} locale={locale}
          onError={setError} onDone={() => { setDoneAsGuest(true); setStep("done"); }}
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
    </div>
  );
}

// ── Auth gate step ────────────────────────────────────────────────────────────
function AuthGateStep({
  slug, serviceId, slot, serviceName, locale, patient,
  onPatientChange, onError, onContinueAsGuest, onDone,
}: {
  slug: string; serviceId: string; slot: SlotDTO; serviceName: string;
  locale: Locale;
  patient: PatientInfo | null;
  onPatientChange: (p: PatientInfo | null) => void;
  onError: (e: string | null) => void;
  onContinueAsGuest: () => void;
  onDone: (asGuest: boolean) => void;
}) {
  type AuthView = "choice" | "login" | "register";
  const [view, setView] = useState<AuthView>(patient ? "choice" : "choice");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [name, setName]                 = useState("");
  const [confirmPassword, setConfirm]   = useState("");
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

  async function afterAuth() {
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

  // Slot summary shown at the top of the auth gate.
  const slotSummary = (
    <div className="mb-5 rounded-xl bg-surface-2 px-4 py-3 text-[13.5px] text-ink">
      <span className="font-semibold">{serviceName}</span> · {slot.label}
    </div>
  );

  // Already authenticated — show confirm button.
  if (patient) {
    return (
      <Section title="Confirmar reserva">
        {slotSummary}
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-weak px-4 py-3 text-[13.5px] text-brand-ink">
          <Icon name="user" size={15} className="shrink-0" />
          <span>{patient.name || patient.email}</span>
        </div>
        <Btn onClick={() => submitAuthenticated(patient)} disabled={busy} size="lg" full>
          {busy ? "Reservando…" : "Confirmar reserva"}
        </Btn>
        {localError && <p className="mt-3 text-[13px] text-error">{localError}</p>}
      </Section>
    );
  }

  // Choice: sign in, create account, or continue as guest.
  if (view === "choice") {
    return (
      <Section title="Completa tu reserva">
        {slotSummary}

        <div className="flex flex-col gap-2">
          <button type="button" onClick={handleGoogle} disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-[14.5px] font-semibold text-ink shadow-sm transition-all hover:border-brand-line hover:shadow-md disabled:opacity-60">
            <GoogleIcon /> Continuar con Google
          </button>
          <button type="button" onClick={() => { setLocalError(null); setView("login"); }} disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-[14.5px] font-semibold text-ink shadow-sm transition-all hover:border-brand-line hover:shadow-md">
            <Icon name="mail" size={18} className="text-ink-soft" /> Iniciar sesión
          </button>
          <button type="button" onClick={() => { setLocalError(null); setView("register"); }} disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-brand-line bg-brand-weak px-4 py-3.5 text-[14.5px] font-semibold text-brand-ink shadow-sm transition-all hover:bg-brand-weak/70">
            <Icon name="user" size={18} /> Crear cuenta
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[12px] text-ink-soft">o</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <button type="button" onClick={onContinueAsGuest} disabled={busy}
          className="mt-4 w-full text-center text-[13.5px] font-medium text-ink-soft hover:text-ink">
          Continuar como invitado →
        </button>
        <p className="mt-1 text-center text-[12px] text-ink-soft">
          La clínica revisará tu solicitud en un plazo de 24h.
        </p>

        {localError && <p className="mt-3 text-[13px] text-error">{localError}</p>}
      </Section>
    );
  }

  // Email login form.
  if (view === "login") {
    return (
      <Section title="Iniciar sesión">
        {slotSummary}
        <div className="flex flex-col gap-3">
          <input type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={busy} className={inputBase} />
          <input type="password" placeholder="Contraseña" value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={busy}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()} className={inputBase} />
          <Btn onClick={handleLogin} disabled={busy} full>{busy ? "Accediendo…" : "Iniciar sesión"}</Btn>
        </div>
        {localError && <p className="mt-3 text-[13px] text-error">{localError}</p>}
        <p className="mt-4 text-center text-[13px] text-ink-soft">
          ¿No tienes cuenta?{" "}
          <button type="button" onClick={() => { setView("register"); setLocalError(null); }}
            className="font-medium text-brand hover:underline">
            Crear una
          </button>
        </p>
        <button type="button" onClick={() => { setView("choice"); setLocalError(null); }}
          className="mt-2 flex items-center gap-1 text-[13px] text-ink-soft hover:text-ink">
          <Icon name="chevronLeft" size={14} /> Atrás
        </button>
      </Section>
    );
  }

  // Register form.
  return (
    <Section title="Crear cuenta">
      {slotSummary}
      <div className="flex flex-col gap-3">
        <input type="text" placeholder="Nombre y apellido" value={name}
          onChange={(e) => setName(e.target.value)} disabled={busy} className={inputBase} />
        <input type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} disabled={busy} className={inputBase} />
        <input type="password" placeholder="Contraseña" value={password}
          onChange={(e) => setPassword(e.target.value)} disabled={busy} className={inputBase} />
        <input type="password" placeholder="Confirmar contraseña" value={confirmPassword}
          onChange={(e) => setConfirm(e.target.value)} disabled={busy}
          onKeyDown={(e) => e.key === "Enter" && handleRegister()} className={inputBase} />
        <Btn onClick={handleRegister} disabled={busy} full>{busy ? "Creando cuenta…" : "Crear cuenta y reservar"}</Btn>
      </div>
      {localError && <p className="mt-3 text-[13px] text-error">{localError}</p>}
      <p className="mt-4 text-center text-[13px] text-ink-soft">
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={() => { setView("login"); setLocalError(null); }}
          className="font-medium text-brand hover:underline">
          Inicia sesión
        </button>
      </p>
      <button type="button" onClick={() => { setView("choice"); setLocalError(null); }}
        className="mt-2 flex items-center gap-1 text-[13px] text-ink-soft hover:text-ink">
        <Icon name="chevronLeft" size={14} /> Atrás
      </button>
    </Section>
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDTO[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  function isSelectable(d: Date) { return d >= today && d <= maxDate && openSet.has(jsDowToDayId(d.getDay())); }

  async function pickDay(d: Date) {
    const ds = ymd(d); setSelectedDate(ds); setSlots(null); setLoadingSlots(true); onError(null);
    const res = await getAvailableSlots({ slug, serviceId, providerId, date: ds, dict: dict.errors });
    setLoadingSlots(false);
    if (!res.ok) { onError(res.error); return; }
    setSlots(res.slots);
  }

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

      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((d, i) => {
          const ds = ymd(d); const sel = isSelectable(d); const selected = ds === selectedDate;
          return (
            <button key={i} disabled={!sel} onClick={() => pickDay(d)}
              className={`flex flex-col items-center gap-0.5 rounded-xl border py-2 transition-all ${
                selected ? "border-brand bg-brand text-white"
                : sel ? "border-line bg-surface text-ink hover:border-brand-line hover:bg-brand-weak"
                : "cursor-default border-transparent text-ink-soft/30"}`}>
              <span className="text-[10.5px] font-semibold uppercase">{dict.weekdaysShort[i]}</span>
              <span className="text-[15px] font-semibold leading-none">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-5">
          {loadingSlots && <p className="text-[13.5px] text-ink-soft">{w.searchingSlots}</p>}
          {!loadingSlots && slots?.length === 0 && <p className="text-[13.5px] text-ink-soft">{w.noSlotsThisDay}</p>}
          {!loadingSlots && slots && slots.length > 0 && (
            isTeamAny ? (
              <div className="flex flex-col gap-5">
                {groupByProvider(slots).map((group) => (
                  <div key={group.providerId ?? "any"}>
                    <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[.04em] text-ink-soft">{group.providerName}</h3>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {group.slots.map((s) => (
                        <button key={`${s.startIso}-${s.providerId ?? ""}`} onClick={() => onPick(selectedDate, s)}
                          className="rounded-lg border border-line py-2 text-[13.5px] font-semibold text-ink transition-all hover:border-brand hover:bg-brand hover:text-white">
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {slots.map((s) => (
                  <button key={`${s.startIso}-${s.providerId ?? ""}`} onClick={() => onPick(selectedDate, s)}
                    className="rounded-lg border border-line py-2 text-[13.5px] font-semibold text-ink transition-all hover:border-brand hover:bg-brand hover:text-white">
                    {s.label}
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </Section>
  );
}

function DetailsStep({ slug, serviceId, providerId, slot, serviceName, dict, locale, onError, onDone }: {
  slug: string; serviceId: string; providerId: string | null; slot: SlotDTO;
  serviceName: string; dict: BookingPageDictionary; locale: Locale;
  onError: (e: string | null) => void; onDone: () => void;
}) {
  const w = dict.wizard;
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy]   = useState(false);

  const fieldBase = "rounded-[10px] border border-line bg-surface px-[13px] py-3 text-[15px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)]";

  async function submit() {
    onError(null);
    if (name.trim().length < 2) return onError(w.errNameRequired);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return onError(w.errEmailInvalid);
    setBusy(true);
    const res = await submitBooking({
      slug, serviceId, providerId, startIso: slot.startIso,
      clientName: name, clientEmail: email, clientPhone: phone,
      guestLocale: locale,
      // No patientId — this is the guest path.
    });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    onDone();
  }

  return (
    <Section title={w.yourDetails}>
      <div className="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-[13.5px] text-ink">
        <span className="font-semibold">{serviceName}</span> · {slot.label}
      </div>
      <div className="flex flex-col gap-3">
        <input className={fieldBase} placeholder={w.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <input className={fieldBase} placeholder={w.emailPlaceholder} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
        <input className={fieldBase} placeholder={w.phonePlaceholder} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
      </div>
      <div className="mt-5">
        <Btn onClick={submit} disabled={busy} size="lg" full>
          {busy ? w.booking : w.bookButton}
        </Btn>
      </div>
    </Section>
  );
}
