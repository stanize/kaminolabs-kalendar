import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import Link from "next/link";
import { requireSession } from "@/lib/auth-session";
import { getSetupProgress } from "@/lib/business/data";
import { bookingPath, bookingUrlDisplay } from "@/lib/business/booking-url";

export default async function PanelHomePage() {
  const session = await requireSession();
  const { business, hasServices, hasActiveHours, hasTeam } = await getSetupProgress(
    session.user.id
  );

  const firstName = session.user.name?.split(" ")[0] ?? "";

  const setupItems = [
    {
      id:    "business",
      label: "Configura tu negocio",
      sub:   "Nombre, tipo y ciudad",
      done:  !!business,
      href:  "/panel/settings",
      icon:  "building",
    },
    {
      id:    "services",
      label: "Crea tus servicios",
      sub:   "Lo que tus clientes podrán reservar",
      done:  hasServices,
      href:  "/panel/services",
      icon:  "sparkles",
    },
    {
      id:    "schedule",
      label: "Define tu disponibilidad",
      sub:   "Los días y horas en que aceptas citas",
      done:  hasActiveHours,
      href:  "/panel/availability",
      icon:  "clock",
    },
    {
      id:    "team",
      label: "Añade tu equipo",
      sub:   "Tú y las personas que trabajan contigo",
      done:  hasTeam,
      href:  "/panel/team",
      icon:  "users",
    },
  ];

  const completedCount = setupItems.filter((i) => i.done).length;
  const percentage     = Math.round((completedCount / setupItems.length) * 100);
  const allDone        = completedCount === setupItems.length;

  return (
    <div className="mx-auto max-w-[860px] px-8 py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">
          {firstName ? `Hola, ${firstName}` : "Inicio"}
        </h1>
        <p className="text-[15px] text-ink-soft">Bienvenido a tu panel de Kalendar.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {!allDone && (
            <div className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[17px]">Configura tu página de reservas</h2>
                <span className="text-[14px] font-semibold text-ink-soft">{percentage}%</span>
              </div>
              <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex flex-col gap-2">
                {setupItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center gap-3.5 rounded-xl border border-line px-4 py-3.5 transition-all duration-150 hover:border-brand-line hover:bg-brand-weak"
                  >
                    <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${item.done ? "bg-brand text-white" : "border-2 border-line bg-surface"}`}>
                      {item.done && <Icon name="check" size={13} strokeWidth={2.5} />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-[14px] font-semibold ${item.done ? "text-ink-soft line-through" : "text-ink"}`}>
                        {item.label}
                      </p>
                      <p className="text-[12.5px] text-ink-soft">{item.sub}</p>
                    </div>
                    {!item.done && <Icon name="arrowRight" size={16} className="shrink-0 text-ink-soft" />}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {allDone && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-line bg-brand-weak px-5 py-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white">
                <Icon name="check" size={18} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-brand-ink">¡Todo configurado!</p>
                <p className="text-[13px] text-brand-ink/80">Tu página de reservas está lista para recibir clientes.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {business?.slug && (
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <p className="mb-1 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
                Tu página de reservas
              </p>
              <p className="mb-3 truncate text-[14px] font-semibold text-ink">
                {bookingUrlDisplay(business.slug)}
              </p>
              <Link href={bookingPath(business.slug)} target="_blank">
                <Btn variant="outline" size="sm" full>
                  <Icon name="externalLink" size={14} /> Ver página
                </Btn>
              </Link>
            </div>
          )}

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="mb-1 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
              Accesos rápidos
            </p>
            <div className="mt-3 flex flex-col gap-1">
              {[
                { label: "Servicios",      href: "/panel/services",      icon: "sparkles" },
                { label: "Disponibilidad", href: "/panel/availability", icon: "clock" },
                { label: "Equipo",         href: "/panel/team",         icon: "users" },
                { label: "Ajustes",        href: "/panel/settings",        icon: "settings" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <Icon name={item.icon} size={15} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
