"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { getAvailableSlots, submitBooking, type SlotDTO } from "@/lib/actions/booking";
import type { DayId } from "@/lib/onboarding/types";
import type { Locale } from "@/lib/i18n/config";
import { getBookingPageDictionary, type BookingPageDictionary } from "@/lib/i18n/dictionaries/booking-page";

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

function priceLabel(p: number, freeLabel: string): string {
  return p === 0 ? freeLabel : `${p} €`;
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

/** Groups "Cualquiera" slots by provider, preserving provider order and sorting
 *  each provider's slots by time. */
function groupByProvider(
  slots: SlotDTO[]
): { providerId: string | null; providerName: string | null; slots: SlotDTO[] }[] {
  const groups: { providerId: string | null; providerName: string | null; slots: SlotDTO[] }[] = [];
  for (const s of slots) {
    let g = groups.find((x) => x.providerId === s.providerId);
    if (!g) {
      g = { providerId: s.providerId, providerName: s.providerName, slots: [] };
      groups.push(g);
    }
    g.slots.push(s);
  }
  for (const g of groups) g.slots.sort((a, b) => a.startIso.localeCompare(b.startIso));
  // Order providers by name for stable display.
  groups.sort((a, b) => (a.providerName ?? "").localeCompare(b.providerName ?? ""));
  return groups;
}

export function BookingWizard({
  slug,
  services,
  members,
  openDays,
  bookingWindowMonths,
  isTeam,
  locale,
}: {
  slug: string;
  services: Service[];
  members: Member[];
  openDays: DayId[]; // weekdays that have any hours
  bookingWindowMonths: number;
  isTeam: boolean;
  // Controlled by the parent BookingPageShell, which owns the guest's language
  // choice for the whole page (header, wizard, footer) so they stay in sync.
  locale: Locale;
}) {
  type Step = "service" | "provider" | "date" | "details" | "done";
  const [step, setStep] = useState<Step>("service");

  const dict = getBookingPageDictionary(locale);
  const w = dict.wizard;

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
          <Icon name="chevronLeft" size={15} /> {w.back}
        </button>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === "service" && (
        <Section title={w.chooseService}>
          <div className="flex flex-col gap-2">
            {services.length === 0 && (
              <p className="text-[14px] text-ink-soft">{w.noServices}</p>
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
                    {s.duration_min} {w.minutesUnit} · {priceLabel(s.price, w.freeLabel)}
                  </span>
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
          dict={dict}
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
          providerId={slot.providerId}
          slot={slot}
          serviceName={service.name}
          dict={dict}
          locale={locale}
          onError={setError}
          onDone={() => setStep("done")}
        />
      )}

      {step === "done" && (
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-weak text-brand">
            <Icon name="mail" size={24} />
          </div>
          <h2 className="mb-1.5 text-[20px]">{w.doneTitle}</h2>
          <p className="mx-auto mb-6 max-w-[360px] text-[14px] text-ink-soft">{w.doneBody}</p>
          <Btn variant="outline" onClick={reset}>
            {w.bookAnother}
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

// ── Date + time step (week strip + slots below) ──────────────────────────────
function startOfWeekMon(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - dow);
  return x;
}

function DateTimeStep({
  slug,
  serviceId,
  providerId,
  openDays,
  bookingWindowMonths,
  dict,
  onError,
  onPick,
}: {
  slug: string;
  serviceId: string;
  providerId: string | null;
  openDays: DayId[];
  bookingWindowMonths: number;
  dict: BookingPageDictionary;
  onError: (e: string | null) => void;
  onPick: (date: string, slot: SlotDTO) => void;
}) {
  const w = dict.wizard;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + bookingWindowMonths);

  const openSet = new Set(openDays);

  const [weekStart, setWeekStart] = useState<Date>(startOfWeekMon(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDTO[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // The 7 days of the current week strip.
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

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
    const res = await getAvailableSlots({ slug, serviceId, providerId, date: ds, dict: dict.errors });
    setLoadingSlots(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    setSlots(res.slots);
  }

  function shiftWeek(deltaWeeks: number) {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + deltaWeeks * 7);
    setWeekStart(next);
  }

  const thisWeekStart = startOfWeekMon(today);
  const canPrev = weekStart > thisWeekStart;
  const canNext = (() => {
    const nextStart = new Date(weekStart);
    nextStart.setDate(nextStart.getDate() + 7);
    return nextStart <= maxDate;
  })();

  const isTeamAny = providerId === null; // "Cualquiera": slots carry provider labels

  const monthLabel = `${dict.months[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  return (
    <Section title={w.chooseDateTime}>
      {/* Week navigator */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => shiftWeek(-1)}
          disabled={!canPrev}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2 disabled:opacity-30"
          aria-label={w.prevWeek}
        >
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="text-[14px] font-semibold capitalize text-ink">{monthLabel}</span>
        <button
          onClick={() => shiftWeek(1)}
          disabled={!canNext}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2 disabled:opacity-30"
          aria-label={w.nextWeek}
        >
          <Icon name="chevronRight" size={16} />
        </button>
      </div>

      {/* Week strip: 7 day chips */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((d, i) => {
          const ds = ymd(d);
          const selectable = isSelectable(d);
          const selected = ds === selectedDate;
          return (
            <button
              key={i}
              disabled={!selectable}
              onClick={() => pickDay(d)}
              className={`flex flex-col items-center gap-0.5 rounded-xl border py-2 transition-all ${
                selected
                  ? "border-brand bg-brand text-white"
                  : selectable
                    ? "border-line bg-surface text-ink hover:border-brand-line hover:bg-brand-weak"
                    : "cursor-default border-transparent text-ink-soft/30"
              }`}
            >
              <span className="text-[10.5px] font-semibold uppercase">{dict.weekdaysShort[i]}</span>
              <span className="text-[15px] font-semibold leading-none">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Slots for the selected day */}
      {selectedDate && (
        <div className="mt-5">
          {loadingSlots && <p className="text-[13.5px] text-ink-soft">{w.searchingSlots}</p>}
          {!loadingSlots && slots && slots.length === 0 && (
            <p className="text-[13.5px] text-ink-soft">{w.noSlotsThisDay}</p>
          )}
          {!loadingSlots && slots && slots.length > 0 && (
            isTeamAny ? (
              // "Cualquiera": group by provider — each provider's name, then a
              // chip grid of their available times below (like the solo view).
              <div className="flex flex-col gap-5">
                {groupByProvider(slots).map((group) => (
                  <div key={group.providerId ?? "any"}>
                    <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[.04em] text-ink-soft">
                      {group.providerName}
                    </h3>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {group.slots.map((s) => (
                        <button
                          key={`${s.startIso}-${s.providerId ?? ""}`}
                          onClick={() => onPick(selectedDate, s)}
                          className="rounded-lg border border-line py-2 text-[13.5px] font-semibold text-ink transition-all hover:border-brand hover:bg-brand hover:text-white"
                        >
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
                  <button
                    key={`${s.startIso}-${s.providerId ?? ""}`}
                    onClick={() => onPick(selectedDate, s)}
                    className="rounded-lg border border-line py-2 text-[13.5px] font-semibold text-ink transition-all hover:border-brand hover:bg-brand hover:text-white"
                  >
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

function DetailsStep({
  slug,
  serviceId,
  providerId,
  slot,
  serviceName,
  dict,
  locale,
  onError,
  onDone,
}: {
  slug: string;
  serviceId: string;
  providerId: string | null;
  slot: SlotDTO;
  serviceName: string;
  dict: BookingPageDictionary;
  locale: Locale;
  onError: (e: string | null) => void;
  onDone: () => void;
}) {
  const w = dict.wizard;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const inputBase =
    "rounded-[10px] border border-line bg-surface px-[13px] py-3 text-[15px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)]";

  async function submit() {
    onError(null);
    if (name.trim().length < 2) return onError(w.errNameRequired);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return onError(w.errEmailInvalid);
    setBusy(true);
    const res = await submitBooking({
      slug,
      serviceId,
      providerId,
      startIso: slot.startIso,
      clientName: name,
      clientEmail: email,
      clientPhone: phone,
      guestLocale: locale,
      dict: dict.errors,
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
        <input className={inputBase} placeholder={w.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <input className={inputBase} placeholder={w.emailPlaceholder} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
        <input className={inputBase} placeholder={w.phonePlaceholder} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
      </div>
      <div className="mt-5">
        <Btn onClick={submit} disabled={busy} size="lg" full>
          {busy ? w.booking : w.bookButton}
        </Btn>
      </div>
    </Section>
  );
}
