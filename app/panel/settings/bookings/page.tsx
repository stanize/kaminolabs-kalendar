import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { CancellationWindowForm } from "@/components/panel/cancellation-window-form";

export default async function BookingsSettingsPage() {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);
  if (!business) redirect("/panel/business?from=home");

  return <CancellationWindowForm initialHours={business.cancellation_window_hours} />;
}
