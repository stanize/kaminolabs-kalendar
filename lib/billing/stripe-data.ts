import "server-only";
import { getStripeClient } from "@/lib/billing/stripe";

export interface SubscriptionDetail {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null; // unix seconds
  trialEnd: number | null; // unix seconds — null unless status is 'trialing'
  priceAmount: number; // major units, e.g. 49.00
  currency: string;
  interval: string; // "month"
}

export interface PaymentMethodSummary {
  brand: string; // "visa", "mastercard", etc.
  last4: string;
}

export interface InvoiceSummary {
  id: string;
  date: number; // unix seconds
  total: number; // major units
  currency: string;
  status: string; // "paid" | "open" | "void" | "uncollectible" | "draft"
  hostedInvoiceUrl: string | null;
}

/**
 * Reads live subscription state directly from Stripe for display purposes
 * (renewal date, cancel-at-period-end flag, current price). This is
 * deliberately NOT the same thing as kalendar_businesses.subscription_status
 * — that column is the authorization-relevant lifecycle state kept in sync
 * by the webhook (see app/api/webhooks/stripe/route.ts) and is what the rest
 * of the app should gate on. This function is read-only, for the payments
 * page's own richer display, and always reflects the current live Stripe
 * state rather than whatever was last pushed by a webhook.
 */
export async function getSubscriptionDetail(
  stripeSubscriptionId: string
): Promise<SubscriptionDetail | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;

  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const item = subscription.items.data[0];
  if (!item) return null;

  return {
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: item.current_period_end ?? null,
    trialEnd: subscription.trial_end ?? null,
    priceAmount: (item.price.unit_amount ?? 0) / 100,
    currency: (item.price.currency ?? "eur").toUpperCase(),
    interval: item.price.recurring?.interval ?? "month",
  };
}

export async function getDefaultPaymentMethod(
  stripeCustomerId: string
): Promise<PaymentMethodSummary | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;

  const customer = await stripe.customers.retrieve(stripeCustomerId, {
    expand: ["invoice_settings.default_payment_method"],
  });

  if (customer.deleted) return null;

  const pm = customer.invoice_settings?.default_payment_method;
  if (!pm || typeof pm === "string" || !pm.card) {
    // No default set explicitly — fall back to the most recently attached card.
    const methods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
      limit: 1,
    });
    const fallback = methods.data[0];
    if (!fallback?.card) return null;
    return { brand: fallback.card.brand, last4: fallback.card.last4 };
  }

  return { brand: pm.card.brand, last4: pm.card.last4 };
}

export async function listInvoices(
  stripeCustomerId: string,
  limit = 12
): Promise<InvoiceSummary[]> {
  const stripe = getStripeClient();
  if (!stripe) return [];

  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit,
  });

  return invoices.data.map((inv) => ({
    id: inv.id ?? "",
    date: inv.created,
    total: inv.total / 100,
    currency: inv.currency.toUpperCase(),
    status: inv.status ?? "draft",
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
  }));
}
