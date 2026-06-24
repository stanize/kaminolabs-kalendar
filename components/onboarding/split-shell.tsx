import type { ReactNode } from "react";
import clsx from "clsx";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { BookingPreview } from "@/components/onboarding/booking-preview";
import { STEPS, TOTAL_CONFIG_STEPS } from "@/lib/onboarding/data";
import type { OnboardingData } from "@/lib/onboarding/types";

export function SplitShell({
  step,
  title,
  sub,
  d,
  children,
  footer,
}: {
  step: number;
  title: string;
  sub: string;
  d: OnboardingData;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(380px,44%)_1fr]">
      {/* Brand panel + live booking preview */}
      <div
        className="hidden flex-col gap-6 overflow-hidden p-7 text-white md:flex md:p-10 lg:p-12"
        style={{
          background:
            "linear-gradient(160deg, var(--color-brand), color-mix(in oklab, var(--color-brand) 62%, #06181f))",
        }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={21} light />
          <span className="text-[12.5px] font-medium text-white/72">de KaminoLabs</span>
        </div>

        <div>
          <h2 className="text-[clamp(23px,2.4vw,30px)] leading-[1.15] font-display font-semibold text-white">
            Tu página de reservas,
            <br />
            lista en 2 minutos.
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-white/82">
            Mira cómo la verán tus clientes mientras la creas.
          </p>
        </div>

        <div className="flex">
          <BookingPreview d={d} />
        </div>

        <div className="mt-auto flex flex-col gap-0.5">
          {STEPS.slice(0, TOTAL_CONFIG_STEPS).map((s, i) => (
            <div
              key={s.id}
              className={clsx(
                "flex items-center gap-2.5 py-1.5 text-[14px] font-medium text-white/60",
                i === step && "font-semibold text-white",
                i < step && "text-white/85"
              )}
            >
              <span
                className={clsx(
                  "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-white/30 text-[12px]",
                  i === step && "border-white bg-white text-brand",
                  i < step && "border-transparent bg-white/22 text-white"
                )}
              >
                {i < step ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}
              </span>
              {s.title}
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="grid place-items-center overflow-y-auto px-5 py-10 sm:px-8 md:px-12">
        <div className="w-full max-w-[520px]">
          <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-[350ms] ease-[cubic-bezier(.4,0,.2,1)]"
              style={{ width: `${((step + 1) / TOTAL_CONFIG_STEPS) * 100}%` }}
            />
          </div>
          <div className="mb-5">
            <h1 className="mb-1.5 text-[25px]">{title}</h1>
            <p className="m-0 text-[15px] text-ink-soft">{sub}</p>
          </div>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}
