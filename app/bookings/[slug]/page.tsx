import { notFound } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { businessTypeLabel } from "@/lib/onboarding/data";
import { getPublicBookingData } from "@/lib/booking/data";
import { WEEKDAY_ORDER } from "@/lib/availability/constants";
import { BookingWizard } from "@/components/booking/booking-wizard";

export default async function BusinessPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const data = await getPublicBookingData(slug);
  if (!data) notFound();

  const { business, services, hoursByDay, members } = data;
  const openDays = WEEKDAY_ORDER.filter((d) => (hoursByDay[d]?.length ?? 0) > 0);
  const isTeam = business.team_mode === "team";

  return (
    <div className="min-h-screen bg-surface-2 px-5 py-10">
      <div className="mx-auto w-full max-w-[560px]">
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
            {businessTypeLabel(business.type)}
            {business.city ? ` · ${business.city}` : ""}
          </p>
        </div>

        <BookingWizard
          slug={slug}
          services={services}
          members={members}
          openDays={openDays}
          bookingWindowMonths={business.booking_window_months}
          isTeam={isTeam}
        />

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-ink-soft">
          <span>Reservas con</span>
          <Logo size={14} />
        </div>
      </div>
    </div>
  );
}
