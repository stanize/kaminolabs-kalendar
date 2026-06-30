import clsx from "clsx";
import { Icon } from "@/components/ui/icon";
import { businessTypeIcon } from "@/lib/onboarding/data";
import { businessTypeLabelFor } from "@/lib/i18n/dictionaries/business-types";
import { slugify } from "@/lib/onboarding/slug";
import { bookingUrlDisplay } from "@/lib/business/booking-url";
import type { OnboardingData } from "@/lib/onboarding/types";
import type { Locale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionaries/public";

const PREVIEW_DAYS: Record<Locale, string[]> = {
  es: ["lun", "mar", "mié", "jue", "vie"],
  en: ["mon", "tue", "wed", "thu", "fri"],
};

export function BookingPreview({
  d,
  compact,
  locale,
  dict,
}: {
  d: OnboardingData;
  compact?: boolean;
  locale: Locale;
  dict: PublicDictionary["home"];
}) {
  const services = d.services.length
    ? d.services.slice(0, 3)
    : [{ id: "ph", name: dict.previewFirstService, min: 60, price: 40, ph: true }];

  const typeLabel = d.business.type ? businessTypeLabelFor(d.business.type, locale) : "";
  const previewDays = PREVIEW_DAYS[locale];

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
          {bookingUrlDisplay(slugify(d.business.name))}
        </span>
      </div>

      <div className="p-4">
        <div className="mb-3.5 flex items-center gap-2.5 border-b border-line pb-3.5">
          <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-brand-weak text-brand">
            <Icon name={businessTypeIcon(d.business.type)} size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-[16px] font-semibold">
              {d.business.name || dict.previewYourBusiness}
            </div>
            <div className="truncate text-[12.5px] text-ink-soft">
              {typeLabel || dict.previewDefaultTagline}
            </div>
          </div>
        </div>

        <div className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[.04em] text-ink-soft">
          {dict.previewChooseService}
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
                <div className="text-[13.5px] font-semibold">{s.name || dict.previewService}</div>
                <div className="text-[12px] text-ink-soft">{s.min} min</div>
              </div>
              <span className="font-display text-[14px] font-semibold text-brand">{s.price} €</span>
            </div>
          ))}
        </div>

        <div className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[.04em] text-ink-soft">
          {dict.previewChooseDay}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {previewDays.map((day, i) => (
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
