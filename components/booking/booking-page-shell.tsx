"use client";

import { useState } from "react";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { businessTypeLabelFor } from "@/lib/i18n/dictionaries/business-types";
import { getBookingPageDictionary } from "@/lib/i18n/dictionaries/booking-page";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import type { BusinessType, DayId } from "@/lib/onboarding/types";

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

/**
 * Owns the guest's language choice for the WHOLE public booking page (header,
 * wizard, footer) so switching language is consistent across all of it, not
 * just inside the wizard. Session-only (component state) — does not persist
 * across visits or businesses, unlike the home/panel cookie-based switcher.
 */
export function BookingPageShell({
  slug,
  business,
  services,
  members,
  openDays,
  bookingWindowMonths,
  isTeam,
  initialLocale,
}: {
  slug: string;
  business: {
    name: string;
    type: BusinessType;
    city: string | null;
    brand_color: string;
  };
  services: Service[];
  members: Member[];
  openDays: DayId[];
  bookingWindowMonths: number;
  isTeam: boolean;
  initialLocale: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const dict = getBookingPageDictionary(locale);

  return (
    <div className="min-h-screen bg-surface-2 px-5 py-10">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="mb-4 flex justify-end">
          <LocaleSwitcher current={locale} onChange={setLocale} />
        </div>

        {/* Business header */}
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl text-white"
            style={{ backgroundColor: business.brand_color }}
          >
            <Icon name="calendar" size={28} />
          </div>
          <h1 className="mb-1 text-[24px]">{business.name}</h1>
          <p className="text-[14.5px] text-ink-soft">
            {businessTypeLabelFor(business.type, locale)}
            {business.city ? ` · ${business.city}` : ""}
          </p>
        </div>

        <BookingWizard
          slug={slug}
          services={services}
          members={members}
          openDays={openDays}
          bookingWindowMonths={bookingWindowMonths}
          isTeam={isTeam}
          locale={locale}
        />

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-ink-soft">
          <span>{dict.header.poweredBy}</span>
          <Logo size={14} />
        </div>
      </div>
    </div>
  );
}

function LocaleSwitcher({ current, onChange }: { current: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => onChange(loc)}
          className={`rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${
            loc === current ? "bg-brand text-white" : "text-ink-soft hover:text-ink"
          }`}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
