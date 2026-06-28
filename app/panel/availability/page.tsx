import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getBusinessHoursForUser } from "@/lib/availability/data";
import { AvailabilityManager } from "@/components/panel/availability-manager";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  if (!business) {
    redirect("/panel/business?from=home");
  }

  const week = await getBusinessHoursForUser(session.user.id);
  const hasSavedHours = Object.keys(week).length > 0;

  const { from } = await searchParams;
  const returnToHome = from === "home";

  return (
    <div className="mx-auto max-w-[680px] px-8 py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">Tu disponibilidad</h1>
        <p className="text-[15px] text-ink-soft">
          Define los días y las horas en que aceptas citas.
        </p>
      </div>

      <AvailabilityManager
        initialWeek={week}
        hasSavedHours={hasSavedHours}
        bookingWindowMonths={business.booking_window_months}
        returnToHome={returnToHome}
      />
    </div>
  );
}
