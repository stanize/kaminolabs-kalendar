import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getBillingState } from "@/lib/billing/data";
import { getBusinessPricing } from "@/lib/pricing/data";
import {
  getSubscriptionDetail,
  getDefaultPaymentMethod,
  listInvoices,
} from "@/lib/billing/stripe-data";
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

  // Richer live-from-Stripe data only fetched once a subscription actually
  // exists — this is what powers the native billing UI (plan/renewal card,
  // payment method, invoice history), distinct from billing.subscriptionStatus
  // which is the webhook-synced value the rest of the app gates on.
  const [subscriptionDetail, paymentMethod, invoices] = billing?.stripeSubscriptionId
    ? await Promise.all([
        getSubscriptionDetail(billing.stripeSubscriptionId),
        billing.stripeCustomerId ? getDefaultPaymentMethod(billing.stripeCustomerId) : null,
        billing.stripeCustomerId ? listInvoices(billing.stripeCustomerId) : [],
      ])
    : [null, null, []];

  const locale = await getLocale();
  const dict = getPaymentsDictionary(locale);

  return (
    <PaymentsManager
      dict={dict}
      billing={billing}
      pricing={pricing}
      subscriptionDetail={subscriptionDetail}
      paymentMethod={paymentMethod}
      invoices={invoices}
    />
  );
}
