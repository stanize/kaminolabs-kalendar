"use client";

import { useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BookingPreview } from "@/components/onboarding/booking-preview";
import { DIAS } from "@/lib/onboarding/data";
import type { OnboardingData } from "@/lib/onboarding/types";

export function StepListo({ d, slug }: { d: OnboardingData; slug: string }) {
  const [copiado, setCopiado] = useState(false);
  const link = `kalendar.app/${slug}`;
  const primerNombre = d.account.nombre.trim().split(" ")[0] || "bienvenida";

  function copiar() {
    navigator.clipboard?.writeText(`https://${link}`).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-[1200px] items-center gap-10 px-6 py-12 md:grid-cols-2 md:gap-[clamp(30px,5vw,70px)] md:px-[clamp(30px,5vw,70px)]">
      <div className="max-w-[540px]">
        <div className="mb-[22px] grid h-[70px] w-[70px] place-items-center rounded-full bg-brand-weak text-brand">
          <Icon name="check" size={38} strokeWidth={2.4} />
        </div>
        <h1 className="mb-3 text-[clamp(27px,3vw,36px)] leading-[1.1]">
          ¡Tu página ya está lista, {primerNombre}!
        </h1>
        <p className="m-0 mb-6 text-[16px] text-ink-soft">
          Comparte este enlace y empieza a recibir reservas hoy mismo.
        </p>

        <div className="mb-3.5 flex items-center gap-2.5 rounded-xl border border-line bg-surface py-2.5 pl-4 pr-2.5 shadow-[0_1px_3px_rgba(15,31,46,.06)]">
          <Icon name="calendar" size={17} className="shrink-0 text-brand" />
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold text-ink">
            {link}
          </span>
          <button
            onClick={copiar}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-brand px-4 py-2.5 text-[14px] font-semibold text-white transition-[filter] duration-150 hover:brightness-[1.07]"
          >
            {copiado ? (
              <>
                <Icon name="check" size={15} /> Copiado
              </>
            ) : (
              "Copiar"
            )}
          </button>
        </div>

        <div className="mb-7 flex flex-wrap gap-2.5">
          <button className="flex items-center gap-[7px] rounded-full border border-line bg-surface px-[15px] py-[9px] text-[13.5px] font-semibold text-ink-soft transition-all duration-150 hover:border-brand-line hover:text-brand">
            <Icon name="mail" size={16} /> Email
          </button>
          <button className="flex items-center gap-[7px] rounded-full border border-line bg-surface px-[15px] py-[9px] text-[13.5px] font-semibold text-ink-soft transition-all duration-150 hover:border-brand-line hover:text-brand">
            <Icon name="phone" size={16} /> WhatsApp
          </button>
          <button className="flex items-center gap-[7px] rounded-full border border-line bg-surface px-[15px] py-[9px] text-[13.5px] font-semibold text-ink-soft transition-all duration-150 hover:border-brand-line hover:text-brand">
            <Icon name="users" size={16} /> Instagram
          </button>
        </div>

        <div className="mb-7 flex flex-wrap gap-3">
          <Link href="/panel">
            <Btn size="lg">
              Ir a mi panel <Icon name="arrowRight" size={17} />
            </Btn>
          </Link>
          <Link href={`/${slug}`}>
            <Btn variant="outline" size="lg">
              Ver mi página
            </Btn>
          </Link>
        </div>

        <div className="flex flex-wrap gap-6 border-t border-line pt-[22px] text-[14px] text-ink-soft">
          <span>
            <b className="mr-1 font-display text-[18px] text-ink">{d.servicios.length}</b> servicios
          </span>
          <span>
            <b className="mr-1 font-display text-[18px] text-ink">
              {DIAS.filter((dia) => d.horario[dia.id].on).length}
            </b>{" "}
            días disponibles
          </span>
          <span>
            <b className="mr-1 font-display text-[18px] text-ink">{d.equipo.length}</b> en el equipo
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-[360px]">
          <BookingPreview d={d} compact />
        </div>
      </div>
    </div>
  );
}
