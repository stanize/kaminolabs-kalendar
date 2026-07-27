"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Btn } from "@/components/ui/button";
import { createCheckoutSession, createBillingPortalSession } from "@/lib/actions/billing";
import type { PaymentsDictionary } from "@/lib/i18n/dictionaries/payments";
import type { BillingState, SubscriptionStatus } from "@/lib/billing/data";
import type { PricingResult } from "@/lib/pricing/types";

interface Props {
  dict: PaymentsDictionary;
  billing: BillingState | null;
  pricing: PricingResult | null;
}

const ACTIVE_LIKE: SubscriptionStatus[] = ["active", "trialing"];

export function PaymentsManager({ dict, billing, pricing }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = billing?.subscriptionStatus ?? "incomplete";
  const isSubscribed = ACTIVE_LIKE.includes(status);
  const arrivedFromCheckout = searchParams.get("status") === "success";

  // Arrival at success_url is not proof of a successful subscription — the
  // webhook is the source of truth (it can land before or after the
  // redirect). Poll for the real status to update rather than trusting the
  // query param, per docs/specs/stripe-subscription-billing-spec.md section 4.
  useEffect(() => {
    if (!arrivedFromCheckout || isSubscribed) return;
    const interval = setInterval(() => router.refresh(), 3000);
    const timeout = setTimeout(() => clearInterval(interval), 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [arrivedFromCheckout, isSubscribed, router]);

  async function handleSubscribe() {
    setPending(true);
    setError(null);
    try {
      const result = await createCheckoutSession();
      if (result.ok) {
        window.location.href = result.url;
      } else {
        setError(result.error);
        setPending(false);
      }
    } catch {
      setError(dict.errUnexpected);
      setPending(false);
    }
  }

  async function handleManageBilling() {
    setPending(true);
    setError(null);
    try {
      const result = await createBillingPortalSession();
      if (result.ok) {
        window.location.href = result.url;
      } else {
        setError(result.error);
        setPending(false);
      }
    } catch {
      setError(dict.errUnexpected);
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-display font-semibold text-neutral-900">{dict.page.title}</h1>
      <p className="mt-1 text-neutral-500">{dict.page.subtitle}</p>

      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColor(status)}`}
          >
            {dict.status[status]}
          </span>
        </div>

        {pricing && (
          <div className="mt-4 space-y-1">
            <p className="text-lg font-semibold text-neutral-900">
              {dict.priceLabel.replace("{price}", pricing.price.toFixed(2))}
            </p>
            {pricing.discountPercent > 0 && (
              <p className="text-sm text-teal-600">
                {dict.discountLabel.replace("{percent}", String(pricing.discountPercent))}
              </p>
            )}
          </div>
        )}

        {billing?.subscriptionCurrentPeriodEnd && (
          <p className="mt-2 text-sm text-neutral-500">
            {dict.renewsOn.replace(
              "{date}",
              new Date(billing.subscriptionCurrentPeriodEnd).toLocaleDateString()
            )}
          </p>
        )}

        {arrivedFromCheckout && !isSubscribed && (
          <p className="mt-4 text-sm text-neutral-500">{dict.confirming}</p>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6">
          {isSubscribed ? (
            <Btn variant="outline" onClick={handleManageBilling} disabled={pending}>
              {pending ? dict.opening : dict.manageBilling}
            </Btn>
          ) : (
            <Btn variant="primary" onClick={handleSubscribe} disabled={pending}>
              {pending ? dict.subscribing : dict.subscribe}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function statusColor(status: SubscriptionStatus): string {
  switch (status) {
    case "active":
    case "trialing":
      return "bg-teal-50 text-teal-700";
    case "past_due":
    case "unpaid":
      return "bg-amber-50 text-amber-700";
    case "cancelled":
      return "bg-neutral-100 text-neutral-600";
    default:
      return "bg-neutral-100 text-neutral-600";
  }
}
