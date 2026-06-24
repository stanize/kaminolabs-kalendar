"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { BookingPreview } from "@/components/onboarding/booking-preview";
import { StepCuenta } from "@/components/onboarding/step-cuenta";
import { StepNegocio } from "@/components/onboarding/step-negocio";
import { StepServicios } from "@/components/onboarding/step-servicios";
import { StepHorario } from "@/components/onboarding/step-horario";
import { StepEquipo } from "@/components/onboarding/step-equipo";
import { StepListo } from "@/components/onboarding/step-listo";
import { authClient } from "@/lib/auth-client";
import { finishOnboarding } from "@/lib/actions/onboarding";
import { skipOnboarding } from "@/lib/actions/skip-onboarding";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { canProceed } from "@/lib/onboarding/validation";
import { DAYS, businessTypeLabel } from "@/lib/onboarding/data";
import { slugify } from "@/lib/onboarding/slug";
import { useRouter } from "next/navigation";
import type { OnboardingData } from "@/lib/onboarding/types";

// ─── Section config ────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "account",  title: "Tu cuenta",         icon: "user"      },
  { id: "business", title: "Tu negocio",         icon: "building"  },
  { id: "services", title: "Servicios",          icon: "sparkles"  },
  { id: "schedule", title: "Disponibilidad",     icon: "clock"     },
  { id: "team",     title: "Equipo",             icon: "users"     },
] as const;

/** One-line summary shown in a collapsed section header */
function sectionSummary(index: number, d: OnboardingData): string {
  switch (index) {
    case 0: return d.account.name || d.account.email;
    case 1: {
      const parts = [businessTypeLabel(d.business.type), d.business.name].filter(Boolean);
      return parts.join(" · ");
    }
    case 2: return `${d.services.length} servicio${d.services.length !== 1 ? "s" : ""}`;
    case 3: {
      const active = DAYS.filter((day) => d.schedule[day.id].on).length;
      return `${active} día${active !== 1 ? "s" : ""} disponible${active !== 1 ? "s" : ""}`;
    }
    case 4: return d.team.map((m) => m.name).filter(Boolean).join(", ");
    default: return "";
  }
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({
  index,
  open,
  locked,
  done,
  onEdit,
  d,
  children,
}: {
  index: number;
  open: boolean;
  locked: boolean;
  done: boolean;
  onEdit: () => void;
  d: OnboardingData;
  children: React.ReactNode;
}) {
  const s = SECTIONS[index];
  return (
    <div
      className={clsx(
        "rounded-2xl border transition-all duration-300",
        locked  && "border-line bg-surface opacity-40",
        !locked && open  && "border-brand-line bg-surface shadow-[0_2px_16px_rgba(13,148,136,.08)]",
        !locked && !open && "border-line bg-surface"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={clsx(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold transition-colors",
          done   && "bg-brand text-white",
          !done  && open   && "bg-brand-weak text-brand",
          !done  && !open  && "bg-surface-2 text-ink-soft"
        )}>
          {done ? <Icon name="check" size={14} strokeWidth={3} /> : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <p className={clsx("text-[14px] font-semibold", locked && "text-ink-soft")}>{s.title}</p>
          {done && !open && (
            <p className="truncate text-[13px] text-ink-soft">{sectionSummary(index, d)}</p>
          )}
        </div>

        {done && !open && !locked && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium text-brand transition-colors hover:bg-brand-weak"
          >
            Editar
          </button>
        )}

        {locked && (
          <Icon name="lock" size={15} className="shrink-0 text-ink-soft" />
        )}
      </div>

      {/* Body — only rendered when open */}
      {open && (
        <div className="border-t border-line px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function OnboardingFlow() {
  const d               = useOnboardingStore((s) => s.d);
  const setGoogleAuthed = useOnboardingStore((s) => s.setGoogleAuthed);
  const reset           = useOnboardingStore((s) => s.reset);
  const goTo            = useOnboardingStore((s) => s.goTo);

  const router = useRouter();

  // openSection: which section is currently expanded
  const [openSection, setOpenSection]   = useState(0);
  // unlockedUpTo: highest section index the user has reached
  const [unlockedUpTo, setUnlockedUpTo] = useState(0);
  const [userName, setUserName]         = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [completed, setCompleted]   = useState(false);
  const [finalData, setFinalData]   = useState<OnboardingData | null>(null);
  const [finalSlug, setFinalSlug]   = useState("");

  const advancedRef = useRef(false);

  function advanceAuth(firstName: string) {
    if (advancedRef.current) return;
    advancedRef.current = true;
    setUserName(firstName);
    setUnlockedUpTo((u) => Math.max(u, 1));
    setOpenSection(1);
    // sync store step for anything that reads it
    goTo(1);
  }

  // Mount: detect existing session (Google OAuth redirect or page refresh)
  useEffect(() => {
    const state = useOnboardingStore.getState();
    if (state.d.account.emailAuthed) {
      const firstName = state.d.account.name.split(" ")[0] ?? state.d.account.name;
      advanceAuth(firstName);
      return;
    }
    authClient.getSession().then(({ data: session }) => {
      if (!session?.user) return;
      const current = useOnboardingStore.getState();
      if (current.d.account.emailAuthed) return;
      const fullName  = session.user.name ?? "";
      const firstName = fullName.split(" ")[0] ?? fullName;
      if (!current.d.account.googleAuthed) {
        current.setGoogleAuthed(fullName, session.user.email ?? "");
      }
      advanceAuth(firstName);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch emailAuthed flip (set synchronously after email signup)
  useEffect(() => {
    if (d.account.emailAuthed && openSection === 0) {
      const firstName = d.account.name.split(" ")[0] ?? d.account.name;
      advanceAuth(firstName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.account.emailAuthed]);

  // Auto-advance when a section becomes valid
  useEffect(() => {
    for (let i = 1; i <= 4; i++) {
      if (canProceed(i, d) && i === openSection && unlockedUpTo <= i) {
        const next = i + 1;
        if (next <= 4) {
          setUnlockedUpTo(next);
          // Don't auto-jump — let user choose when to move on
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  function handleSectionContinue(sectionIndex: number) {
    if (!canProceed(sectionIndex, d)) return;
    const next = sectionIndex + 1;
    setUnlockedUpTo((u) => Math.max(u, next));
    if (next <= 4) {
      setOpenSection(next);
      goTo(next);
      // Scroll to next section smoothly
      setTimeout(() => {
        document.getElementById(`section-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }

  async function handleFinish() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await finishOnboarding(d);
      if (!result.ok) {
        setError(result.error ?? "Ha ocurrido un error. Inténtalo de nuevo.");
        return;
      }
      setFinalData(d);
      setFinalSlug(result.slug ?? slugify(d.business.name));
      setCompleted(true);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    await skipOnboarding();
    router.push("/panel");
  }

  if (completed && finalData) {
    return <StepListo d={finalData} slug={finalSlug} />;
  }

  const allSectionsDone = [0, 1, 2, 3, 4].every((i) => canProceed(i, d));

  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(380px,44%)_1fr]">

      {/* ── Left: brand panel ─────────────────────────────────────────── */}
      <div
        className="hidden flex-col gap-6 overflow-hidden p-10 text-white md:flex lg:p-12"
        style={{ background: "linear-gradient(160deg, var(--color-brand), color-mix(in oklab, var(--color-brand) 62%, #06181f))" }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={21} light />
          <span className="text-[12.5px] font-medium text-white/72">de KaminoLabs</span>
        </div>
        <div>
          <h2 className="font-display text-[clamp(23px,2.4vw,30px)] font-semibold leading-[1.15] text-white">
            Tu página de reservas,<br />lista en 2 minutos.
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-white/82">
            Mira cómo la verán tus clientes mientras la creas.
          </p>
        </div>
        <div className="flex flex-1 items-center">
          <BookingPreview d={d} />
        </div>
      </div>

      {/* ── Right: accordion form ──────────────────────────────────────── */}
      <div className="overflow-y-auto px-5 py-10 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[540px]">

          {/* Progress bar */}
          <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
              style={{ width: `${([0,1,2,3,4].filter((i) => canProceed(i, d)).length / 5) * 100}%` }}
            />
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-3">

            {/* Section 0 — Account */}
            <div id="section-0">
              <Section index={0} open={openSection === 0} locked={false}
                done={canProceed(0, d)} onEdit={() => setOpenSection(0)} d={d}>
                <StepCuenta />
              </Section>
            </div>

            {/* Section 1 — Business */}
            <div id="section-1">
              <Section index={1} open={openSection === 1} locked={unlockedUpTo < 1}
                done={canProceed(1, d)} onEdit={() => setOpenSection(1)} d={d}>
                {userName && (
                  <p className="mb-4 text-[15px] font-semibold text-ink">
                    ¡Hola, {userName}! Cuéntanos sobre tu negocio.
                  </p>
                )}
                <StepNegocio />
                <SectionFooter
                  canContinue={canProceed(1, d)}
                  onContinue={() => handleSectionContinue(1)}
                  onSkip={handleSkip}
                  skipping={skipping}
                />
              </Section>
            </div>

            {/* Section 2 — Services */}
            <div id="section-2">
              <Section index={2} open={openSection === 2} locked={unlockedUpTo < 2}
                done={canProceed(2, d)} onEdit={() => setOpenSection(2)} d={d}>
                <StepServicios />
                <SectionFooter
                  canContinue={canProceed(2, d)}
                  onContinue={() => handleSectionContinue(2)}
                  onSkip={handleSkip}
                  skipping={skipping}
                />
              </Section>
            </div>

            {/* Section 3 — Schedule */}
            <div id="section-3">
              <Section index={3} open={openSection === 3} locked={unlockedUpTo < 3}
                done={canProceed(3, d)} onEdit={() => setOpenSection(3)} d={d}>
                <StepHorario />
                <SectionFooter
                  canContinue={canProceed(3, d)}
                  onContinue={() => handleSectionContinue(3)}
                  onSkip={handleSkip}
                  skipping={skipping}
                />
              </Section>
            </div>

            {/* Section 4 — Team */}
            <div id="section-4">
              <Section index={4} open={openSection === 4} locked={unlockedUpTo < 4}
                done={canProceed(4, d)} onEdit={() => setOpenSection(4)} d={d}>
                <StepEquipo />
                <SectionFooter
                  canContinue={canProceed(4, d)}
                  isLast
                  onSkip={handleSkip}
                  skipping={skipping}
                />
              </Section>
            </div>

            {/* Final CTA — appears once all sections are done */}
            {allSectionsDone && (
              <div className="rounded-2xl border border-brand-line bg-brand-weak p-5">
                {error && (
                  <p className="mb-3 rounded-xl bg-error-weak px-3.5 py-2.5 text-[13px] font-medium text-error">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-4 text-[16px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60"
                >
                  {submitting ? "Creando tu página…" : <>Crear mi página <Icon name="arrowRight" size={18} /></>}
                </button>
                <p className="mt-2.5 text-center text-[12.5px] text-ink-soft">
                  Todo listo — ya puedes empezar a recibir reservas.
                </p>
              </div>
            )}

            {/* Skip link — always visible once authed */}
            {canProceed(0, d) && !allSectionsDone && (
              <p className="text-center text-[13px] text-ink-soft">
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={skipping}
                  className="underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
                >
                  {skipping ? "Redirigiendo…" : "Completar más tarde"}
                </button>
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section footer (continue / skip) ───────────────────────────────────────

function SectionFooter({
  canContinue,
  onContinue,
  onSkip,
  skipping,
  isLast = false,
}: {
  canContinue?: boolean;
  onContinue?: () => void;
  onSkip: () => void;
  skipping: boolean;
  isLast?: boolean;
}) {
  if (isLast) return null; // last section uses the global CTA instead

  return (
    <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
      <button
        type="button"
        onClick={onSkip}
        disabled={skipping}
        className="text-[13px] font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
      >
        {skipping ? "Redirigiendo…" : "Más tarde"}
      </button>
      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continuar <Icon name="arrowRight" size={15} />
      </button>
    </div>
  );
}
