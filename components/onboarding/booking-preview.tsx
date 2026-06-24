import clsx from "clsx";
import { Icon } from "@/components/ui/icon";
import { businessTypeIcon, businessTypeLabel } from "@/lib/onboarding/data";
import { slugify } from "@/lib/onboarding/slug";
import type { OnboardingData } from "@/lib/onboarding/types";

const PREVIEW_DAYS = ["lun", "mar", "mié", "jue", "vie"];

export function BookingPreview({ d, compact }: { d: OnboardingData; compact?: boolean }) {
  const services = d.services.length
    ? d.services.slice(0, 3)
    : [{ id: "ph", name: "Tu primer servicio", min: 60, price: 40, ph: true }];

  return (
    <div
      className={clsx(
        "w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_12px_40px_rgba(15,31,46,.09)]",
        compact && "max-w-[360px]"
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2.5">
        <span className="h-2 w-2 rounded-full bg-line" />
        <span className="h-2 w-2 rounded-full bg-line" />
        <span className="h-2 w-2 rounded-full bg-line" />
        <span className="ml-2 truncate text-[11.5px] font-medium text-ink-soft">
          kalendar.app/{slugify(d.business.name)}
        </span>
      </div>

      <div className="p-4">
        <div className="mb-3.5 flex items-center gap-2.5 border-b border-line pb-3.5">
          <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-brand-weak text-brand">
            <Icon name={businessTypeIcon(d.business.type)} size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-[16px] font-semibold">
              {d.business.name || "Tu negocio"}
            </div>
            <div className="truncate text-[12.5px] text-ink-soft">
              {businessTypeLabel(d.business.type) || "Reserva tu cita online"}
            </div>
          </div>
        </div>

        <div className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[.04em] text-ink-soft">
          Elige un servicio
        </div>
        <div className="mb-4 flex flex-col gap-2">
          {services.map((s) => (
            <div
              key={s.id}
              className={clsx(
                "flex items-center justify-between rounded-[10px] border border-line px-3 py-2.5",
                "ph" in s && s.ph && "border-dashed opacity-50"
              )}
            >
              <div>
                <div className="text-[13.5px] font-semibold">{s.name || "Servicio"}</div>
                <div className="text-[12px] text-ink-soft">{s.min} min</div>
              </div>
              <span className="font-display text-[14px] font-semibold text-brand">{s.price} €</span>
            </div>
          ))}
        </div>

        <div className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[.04em] text-ink-soft">
          Elige día
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {PREVIEW_DAYS.map((day, i) => (
            <div
              key={day}
              className={clsx(
                "flex flex-col items-center gap-0.5 rounded-[9px] border border-line py-2",
                i === 2 && "border-brand bg-brand text-white"
              )}
            >
              <span className={clsx("text-[11px] capitalize text-ink-soft", i === 2 && "text-white/85")}>
                {day}
              </span>
              <b className="font-display text-[15px]">{18 + i}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
