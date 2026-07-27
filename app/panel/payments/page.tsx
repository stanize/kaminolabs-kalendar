import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getBillingState } from "@/lib/billing/data";
import { getBusinessPricing } from "@/lib/pricing/data";
import { getLocale } from "@/lib/i18n/server";
import { getPaymentsDictionary } from "@/lib/i18n/dictionaries/payments";
import { PaymentsManager } from "@/components/panel/payments-manager";

export default async function PaymentsPage() {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  if (!business) {
    redirect("/panel/business?from=home");
  }

  const [billing, pricing] = await Promise.all([
    getBillingState(business.id),
    getBusinessPricing(business.id),
  ]);

  const locale = await getLocale();
  const dict = getPaymentsDictionary(locale);

  return (
    <PaymentsManager
      dict={dict}
      billing={billing}
      pricing={pricing}
    />
  );
}
