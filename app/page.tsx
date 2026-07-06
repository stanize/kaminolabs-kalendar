import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { HeroSignup } from "@/components/landing/hero-signup";
import { Btn } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BookingPreview } from "@/components/onboarding/booking-preview";
import { BUSINESS_TYPES } from "@/lib/onboarding/data";
import { businessTypeLabelFor } from "@/lib/i18n/dictionaries/business-types";
import { LANDING_EXAMPLES } from "@/lib/landing/ejemplos";
import { getPublicServerDictionary } from "@/lib/i18n/server";

const ROTATIONS   = ["-rotate-3", "rotate-2", "-rotate-1", "rotate-3"];
const OFFSETS     = ["md:translate-y-3", "md:-translate-y-2", "md:translate-y-4", "md:-translate-y-1"];

export default async function LandingPage() {
  const { locale, dict } = await getPublicServerDictionary();
  const h = dict.home;

  const steps = [
    { number: "1", title: h.step1Title, text: h.step1Text },
    { number: "2", title: h.step2Title, text: h.step2Text },
    { number: "3", title: h.step3Title, text: h.step3Text },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ===== Hero ===== */}
        <section className="px-5 pb-20 pt-16 text-center sm:px-8 sm:pt-24">
          <h1 className="mx-auto max-w-[760px] text-[clamp(32px,5vw,52px)] leading-[1.08]">
            {h.heroTitle}
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-ink-soft sm:text-[18px]">
            {h.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <HeroSignup emailPlaceholder={h.heroEmailPlaceholder} ctaLabel={h.startFree} />
            <span className="text-[13px] font-medium text-ink-soft">{h.noCreditCard}</span>
          </div>
        </section>

        {/* ===== Live booking page previews ===== */}
        <section className="overflow-x-clip px-5 pb-24 sm:px-8">
          <div className="mx-auto flex max-w-[1180px] flex-wrap justify-center gap-6 md:flex-nowrap">
            {LANDING_EXAMPLES.map((example, i) => (
              <div
                key={example.business.name}
                className={`w-[260px] shrink-0 transition-transform duration-300 hover:translate-y-0! hover:rotate-0! ${ROTATIONS[i]} ${OFFSETS[i]}`}
              >
                <BookingPreview d={example} compact locale={locale} dict={h} />
              </div>
            ))}
          </div>
        </section>

        {/* ===== Who it's for ===== */}
        <section id="para-quien" className="border-t border-line bg-surface px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-[1000px] text-center">
            <h2 className="text-[clamp(26px,3.5vw,34px)]">{h.whoForTitle}</h2>
            <p className="mx-auto mt-3 max-w-[520px] text-[16px] text-ink-soft">{h.whoForSubtitle}</p>
            <div className="mx-auto mt-10 grid max-w-[760px] grid-cols-2 gap-3 sm:grid-cols-4">
              {BUSINESS_TYPES.map((bt) => (
                <div
                  key={bt.id}
                  className="flex flex-col items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-6 text-center"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-weak text-brand">
                    <Icon name={bt.icon} size={19} />
                  </div>
                  <span className="text-[13.5px] font-semibold text-ink">
                    {businessTypeLabelFor(bt.id, locale)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== How it works ===== */}
        <section id="como-funciona" className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-[1000px]">
            <h2 className="text-center text-[clamp(26px,3.5vw,34px)]">{h.howTitle}</h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="rounded-2xl border border-line bg-surface p-7">
                  <div className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-brand text-[14px] font-bold text-white">
                    {step.number}
                  </div>
                  <h3 className="mb-1.5 text-[18px]">{step.title}</h3>
                  <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Final CTA ===== */}
        <section
          className="mx-5 mb-20 rounded-[28px] px-6 py-16 text-center text-white sm:mx-8"
          style={{
            background:
              "linear-gradient(160deg, var(--color-brand), color-mix(in oklab, var(--color-brand) 62%, #06181f))",
          }}
        >
          <h2 className="mx-auto max-w-[520px] text-[clamp(26px,3.5vw,32px)] text-white">
            {h.ctaTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-[440px] text-[15.5px] text-white/85">{h.ctaSubtitle}</p>
          <Link href="/signup" className="mt-7 inline-block">
            <Btn size="lg" variant="outline" className="border-white bg-white text-brand-ink hover:text-brand-ink">
              {h.ctaButton} <Icon name="arrowRight" size={18} />
            </Btn>
          </Link>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-[13px] text-ink-soft">{h.footerTagline}</span>
          <span className="text-[13px] text-ink-soft">
            © {new Date().getFullYear()} KaminoLabs. {h.footerRights}
          </span>
        </div>
      </footer>
    </div>
  );
}
