"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { getAvailableSlots, submitBooking, type SlotDTO } from "@/lib/actions/booking";
import type { DayId } from "@/lib/onboarding/types";

interface Service {
  id: string;
  name: string;
  duration_min: number;
  price: number;
}
interface Member {
  id: string;
  name: string;
  role: string | null;
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DOW_SHORT = ["L", "M", "X", "J", "V", "S", "D"]; // Mon-first

function priceLabel(p: number): string {
  return p === 0 ? "Gratis" : `${p} €`;
}

// Local calendar helpers (operate on the visitor's local date for the picker UI;
// the chosen Y-M-D is sent to the server which interprets it in business tz).
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function jsDowToDayId(dow: number): DayId {
  // JS: 0=Sun..6=Sat -> our DayId
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as DayId[])[dow];
}

export function BookingWizard({
  slug,
  services,
  members,
  openDays,
  bookingWindowMonths,
  isTeam,
}: {
  slug: string;
  services: Service[];
  members: Member[];
  openDays: DayId[]; // weekdays that have any hours
  bookingWindowMonths: number;
  isTeam: boolean;
}) {
  type Step = "service" | "provider" | "date" | "details" | "done";
  const [step, setStep] = useState<Step>("service");

  const [service, setService] = useState<Service | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null); // null = cualquiera
  const [date, setDate] = useState<string | null>(null); // YYYY-MM-DD
  const [slot, setSlot] = useState<SlotDTO | null>(null);

  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("service");
    setService(null);
    setProviderId(null);
    setDate(null);
    setSlot(null);
    setError(null);
  }

  function chooseService(s: Service) {
    setService(s);
    setError(null);
    setStep(isTeam ? "provider" : "date");
  }

  function chooseProvider(id: string | null) {
    setProviderId(id);
    setError(null);
    setStep("date");
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_12px_40px_rgba(15,31,46,.06)]">
      {step !== "service" && step !== "done" && (
        <button
          onClick={() => {
            setError(null);
            if (step === "provider") setStep("service");
            else if (step === "date") setStep(isTeam ? "provider" : "service");
            else if (step === "details") setStep("date");
          }}
          className="mb-4 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink"
        >
          <Icon name="chevronLeft" size={15} /> Atrás
        </button>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === "service" && (
        <Section title="Elige un servicio">
          <div className="flex flex-col gap-2">
            {services.length === 0 && (
              <p className="text-[14px] text-ink-soft">Este negocio aún no tiene servicios disponibles.</p>
            )}
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => chooseService(s)}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3.5 text-left transition-all hover:border-brand-line hover:bg-brand-weak"
              >
                <span>
                  <span className="block text-[14.5px] font-semibold text-ink">{s.name}</span>
                  <span className="block text-[12.5px] text-ink-soft">
                    {s.duration_min} min · {priceLabel(s.price)}
                  </span>
                </span>
                <Icon name="chevronRight" size={16} className="text-ink-soft" />
              </button>
            ))}
          </div>
        </Section>
      )}

      {step === "provider" && (
        <Section title="Elige profesional">
          <div className="flex flex-col gap-2">
            <ProviderButton label="Cualquiera" sub="Primer hueco disponible" onClick={() => chooseProvider(null)} />
            {members.map((m) => (
              <ProviderButton
                key={m.id}
                label={m.name}
                sub={m.role ?? undefined}
                onClick={() => chooseProvider(m.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {step === "date" && service && (
        <DateTimeStep
          slug={slug}
          serviceId={service.id}
          providerId={providerId}
          openDays={openDays}
          bookingWindowMonths={bookingWindowMonths}
          onError={setError}
          onPick={(d, s) => {
            setDate(d);
            setSlot(s);
            setError(null);
            setStep("details");
          }}
        />
      )}

      {step === "details" && service && slot && date && (
        <DetailsStep
          slug={slug}
          serviceId={service.id}
          providerId={providerId}
          slot={slot}
          serviceName={service.name}
          onError={setError}
          onDone={() => setStep("done")}
        />
      )}

      {step === "done" && (
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-weak text-brand">
            <Icon name="mail" size={24} />
          </div>
          <h2 className="mb-1.5 text-[20px]">Revisa tu correo</h2>
          <p className="mx-auto mb-6 max-w-[360px] text-[14px] text-ink-soft">
            Te hemos enviado un email para confirmar tu reserva. Haz clic en el enlace para
            completarla.
          </p>
          <Btn variant="outline" onClick={reset}>
            Hacer otra reserva
          </Btn>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 text-[17px]">{title}</h2>
      {children}
    </div>
  );
}

function ProviderButton({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-xl border border-line px-4 py-3.5 text-left transition-all hover:border-brand-line hover:bg-brand-weak"
    >
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

// ── Date + time step ─────────────────────────────────────────────────────────
function DateTimeStep({
  slug,
  serviceId,
  providerId,
  openDays,
  bookingWindowMonths,
  onError,
  onPick,
}: {
  slug: string;
  serviceId: string;
  providerId: string | null;
  openDays: DayId[];
  bookingWindowMonths: number;
  onError: (e: string | null) => void;
  onPick: (date: string, slot: SlotDTO) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + bookingWindowMonths);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDTO[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const openSet = new Set(openDays);

  // Build the month grid (Mon-first).
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startDow = (firstOfMonth.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  function isSelectable(d: Date): boolean {
    if (d < today || d > maxDate) return false;
    return openSet.has(jsDowToDayId(d.getDay()));
  }

  async function pickDay(d: Date) {
    const ds = ymd(d);
    setSelectedDate(ds);
    setSlots(null);
    setLoadingSlots(true);
    onError(null);
    const res = await getAvailableSlots({ slug, serviceId, providerId, date: ds });
    setLoadingSlots(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    setSlots(res.slots);
  }

  function prevMonth() {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }
  function nextMonth() {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const canGoPrev = new Date(viewYear, viewMonth, 1) > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate;

  return (
    <Section title="Elige fecha y hora">
      {/* Calendar */}
      <div className="rounded-xl border border-line p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2 disabled:opacity-30"
            aria-label="Mes anterior"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="text-[14px] font-semibold capitalize text-ink">
            {MONTHS_ES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            disabled={!canGoNext}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2 disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-soft">
          {DOW_SHORT.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const ds = ymd(d);
            const selectable = isSelectable(d);
            const selected = ds === selectedDate;
            return (
              <button
                key={i}
                disabled={!selectable}
                onClick={() => pickDay(d)}
                className={`aspect-square rounded-lg text-[13px] font-medium transition-colors ${
                  selected
                    ? "bg-brand text-white"
                    : selectable
                      ? "text-ink hover:bg-brand-weak"
                      : "cursor-default text-ink-soft/30"
                }`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      {selectedDate && (
        <div className="mt-4">
          {loadingSlots && <p className="text-[13.5px] text-ink-soft">Buscando horarios…</p>}
          {!loadingSlots && slots && slots.length === 0 && (
            <p className="text-[13.5px] text-ink-soft">No hay horarios disponibles este día.</p>
          )}
          {!loadingSlots && slots && slots.length > 0 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {slots.map((s) => (
                <button
                  key={s.startIso}
                  onClick={() => onPick(selectedDate, s)}
                  className="rounded-lg border border-line py-2 text-[13.5px] font-semibold text-ink transition-all hover:border-brand hover:bg-brand hover:text-white"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

// ── Details step ─────────────────────────────────────────────────────────────
function DetailsStep({
  slug,
  serviceId,
  providerId,
  slot,
  serviceName,
  onError,
  onDone,
}: {
  slug: string;
  serviceId: string;
  providerId: string | null;
  slot: SlotDTO;
  serviceName: string;
  onError: (e: string | null) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const inputBase =
    "rounded-[10px] border border-line bg-surface px-[13px] py-3 text-[15px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)]";

  async function submit() {
    onError(null);
    if (name.trim().length < 2) return onError("Indica tu nombre.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return onError("Indica un email válido.");
    setBusy(true);
    const res = await submitBooking({
      slug,
      serviceId,
      providerId,
      startIso: slot.startIso,
      clientName: name,
      clientEmail: email,
      clientPhone: phone,
    });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    onDone();
  }

  return (
    <Section title="Tus datos">
      <div className="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-[13.5px] text-ink">
        <span className="font-semibold">{serviceName}</span> · {slot.label}
      </div>
      <div className="flex flex-col gap-3">
        <input className={inputBase} placeholder="Nombre y apellido" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <input className={inputBase} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
        <input className={inputBase} placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
      </div>
      <div className="mt-5">
        <Btn onClick={submit} disabled={busy} size="lg" full>
          {busy ? "Reservando…" : "Reservar"}
        </Btn>
      </div>
    </Section>
  );
}
