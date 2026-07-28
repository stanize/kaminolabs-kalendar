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
import { SubscriptionManager } from "@/components/panel/subscription-manager";

export default async function SubscriptionSettingsPage() {
  const session = await requireSession();
  // SettingsLayout (app/panel/settings/layout.tsx) already guards on the
  // business existing and redirects otherwise, so getBusinessForUser here is
  // guaranteed non-null in practice — still typed as nullable since the data
  // function itself doesn't know that.
  const business = await getBusinessForUser(session.user.id);
  if (!business) return null;

  const [billing, pricing] = await Promise.all([
    getBillingState(business.id),
    getBusinessPricing(business.id),
  ]);

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
    <SubscriptionManager
      dict={dict}
      billing={billing}
      pricing={pricing}
      subscriptionDetail={subscriptionDetail}
      paymentMethod={paymentMethod}
      invoices={invoices}
    />
  );
}
