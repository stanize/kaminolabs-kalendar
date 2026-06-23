import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { Btn } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BookingPreview } from "@/components/onboarding/booking-preview";
import { TIPOS } from "@/lib/onboarding/data";
import { EJEMPLOS_LANDING } from "@/lib/landing/ejemplos";

const ROTACIONES = ["-rotate-3", "rotate-2", "-rotate-1", "rotate-3"];
const DESPLAZAMIENTOS = ["md:translate-y-3", "md:-translate-y-2", "md:translate-y-4", "md:-translate-y-1"];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ===== Hero ===== */}
        <section className="px-5 pb-20 pt-16 text-center sm:px-8 sm:pt-24">
          <h1 className="mx-auto max-w-[760px] text-[clamp(32px,5vw,52px)] leading-[1.08]">
            Software de reservas para profesionales que cuidan de sus clientes
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-ink-soft sm:text-[18px]">
            Crea tu página de reservas online, gestiona tus servicios y tu disponibilidad,
            y deja que tus clientes reserven solos — todo en español, listo en menos de 2 minutos.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/onboarding">
              <Btn size="lg">
                Empezar gratis <Icon name="arrowRight" size={18} />
              </Btn>
            </Link>
            <span className="text-[13px] font-medium text-ink-soft">Sin tarjeta de crédito</span>
          </div>
        </section>

        {/* ===== Tira de páginas de reserva en vivo ===== */}
        <section className="overflow-x-clip px-5 pb-24 sm:px-8">
          <div className="mx-auto flex max-w-[1180px] flex-wrap justify-center gap-6 md:flex-nowrap">
            {EJEMPLOS_LANDING.map((ej, i) => (
              <div
                key={ej.negocio.nombre}
                className={`w-[260px] shrink-0 transition-transform duration-300 hover:translate-y-0! hover:rotate-0! ${ROTACIONES[i]} ${DESPLAZAMIENTOS[i]}`}
              >
                <BookingPreview d={ej} compact />
              </div>
            ))}
          </div>
        </section>

        {/* ===== Para quién es ===== */}
        <section id="para-quien" className="border-t border-line bg-surface px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-[1000px] text-center">
            <h2 className="text-[clamp(26px,3.5vw,34px)]">Pensado para quien atiende citas, no agendas</h2>
            <p className="mx-auto mt-3 max-w-[520px] text-[16px] text-ink-soft">
              Kalendar se adapta a tu profesión desde el primer minuto, con plantillas de
              servicios pensadas para cada sector.
            </p>
            <div className="mx-auto mt-10 grid max-w-[760px] grid-cols-2 gap-3 sm:grid-cols-4">
              {TIPOS.map((tipo) => (
                <div
                  key={tipo.id}
                  className="flex flex-col items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-6 text-center"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-weak text-brand">
                    <Icon name={tipo.icon} size={19} />
                  </div>
                  <span className="text-[13.5px] font-semibold text-ink">{tipo.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Cómo funciona ===== */}
        <section id="como-funciona" className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-[1000px]">
            <h2 className="text-center text-[clamp(26px,3.5vw,34px)]">Listo para recibir reservas en 3 pasos</h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {[
                {
                  numero: "1",
                  titulo: "Crea tu cuenta",
                  texto: "Con tu correo o con Google. Sin tarjeta, sin compromiso.",
                },
                {
                  numero: "2",
                  titulo: "Configura tu negocio",
                  texto: "Añade tus servicios, tu horario y tu equipo en un par de minutos.",
                },
                {
                  numero: "3",
                  titulo: "Comparte tu enlace",
                  texto: "Tu página kalendar.app/tu-negocio ya está lista para recibir reservas.",
                },
              ].map((paso) => (
                <div key={paso.numero} className="rounded-2xl border border-line bg-surface p-7">
                  <div className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-brand text-[14px] font-bold text-white">
                    {paso.numero}
                  </div>
                  <h3 className="mb-1.5 text-[18px]">{paso.titulo}</h3>
                  <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">{paso.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA final ===== */}
        <section
          className="mx-5 mb-20 rounded-[28px] px-6 py-16 text-center text-white sm:mx-8"
          style={{
            background:
              "linear-gradient(160deg, var(--color-brand), color-mix(in oklab, var(--color-brand) 62%, #06181f))",
          }}
        >
          <h2 className="mx-auto max-w-[520px] text-[clamp(26px,3.5vw,32px)] text-white">
            Tu página de reservas, lista hoy mismo
          </h2>
          <p className="mx-auto mt-3 max-w-[440px] text-[15.5px] text-white/85">
            Únete a Kalendar y deja que tus clientes reserven solos, a cualquier hora.
          </p>
          <Link href="/onboarding" className="mt-7 inline-block">
            <Btn size="lg" variant="outline" className="border-white bg-white text-brand-ink hover:text-brand-ink">
              Empezar gratis <Icon name="arrowRight" size={18} />
            </Btn>
          </Link>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-[13px] text-ink-soft">Kalendar — de KaminoLabs</span>
          <span className="text-[13px] text-ink-soft">
            © {new Date().getFullYear()} KaminoLabs. Todos los derechos reservados.
          </span>
        </div>
      </footer>
    </div>
  );
}
