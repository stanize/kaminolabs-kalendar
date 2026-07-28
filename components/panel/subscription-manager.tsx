"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Btn } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
} from "@/lib/actions/billing";
import { PaymentMethodModal } from "@/components/panel/payment-method-modal";
import type { PaymentsDictionary } from "@/lib/i18n/dictionaries/payments";
import type { BillingState, SubscriptionStatus } from "@/lib/billing/data";
import type { PricingResult } from "@/lib/pricing/types";
import type {
  SubscriptionDetail,
  PaymentMethodSummary,
  InvoiceSummary,
} from "@/lib/billing/stripe-data";

interface Props {
  dict: PaymentsDictionary;
  billing: BillingState | null;
  pricing: PricingResult | null;
  subscriptionDetail: SubscriptionDetail | null;
  paymentMethod: PaymentMethodSummary | null;
  invoices: InvoiceSummary[];
}

const ACTIVE_LIKE: SubscriptionStatus[] = ["active", "trialing"];

export function SubscriptionManager({
  dict,
  billing,
  pricing,
  subscriptionDetail,
  paymentMethod,
  invoices,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);

  const status = billing?.subscriptionStatus ?? "incomplete";
  const isSubscribed = ACTIVE_LIKE.includes(status);
  const arrivedFromCheckout = searchParams.get("status") === "success";

  useEffect(() => {
    if (!arrivedFromCheckout || isSubscribed) return;
    const interval = setInterval(() => router.refresh(), 3000);
    const timeout = setTimeout(() => clearInterval(interval), 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [arrivedFromCheckout, isSubscribed, router]);

  async function runRedirectAction(
    action: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>
  ) {
    setPending(true);
    setError(null);
    try {
      const result = await action();
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

  async function handleCancelConfirm() {
    setPending(true);
    setError(null);
    try {
      const result = await cancelSubscription();
      if (result.ok) {
        setConfirmingCancel(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setError(dict.errUnexpected);
    } finally {
      setPending(false);
    }
  }

  async function handleResume() {
    setPending(true);
    setError(null);
    try {
      const result = await resumeSubscription();
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setError(dict.errUnexpected);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColor(status)}`}
        >
          {dict.status[status]}
        </span>

        {pricing && (
          <div className="mt-4 space-y-1">
            <p className="text-lg font-semibold text-ink">
              {dict.priceLabel.replace("{price}", pricing.price.toFixed(2))}
            </p>
            {pricing.discountPercent > 0 && (
              <p className="text-sm text-brand-ink">
                {dict.discountLabel.replace("{percent}", String(pricing.discountPercent))}
              </p>
            )}
          </div>
        )}

        {subscriptionDetail?.cancelAtPeriodEnd && subscriptionDetail.currentPeriodEnd ? (
          <p className="mt-2 text-sm text-error">
            {dict.cancelsOn.replace("{date}", formatDate(subscriptionDetail.currentPeriodEnd))}
          </p>
        ) : billing?.subscriptionCurrentPeriodEnd ? (
          <p className="mt-2 text-sm text-ink-soft">
            {dict.renewsOn.replace(
              "{date}",
              new Date(billing.subscriptionCurrentPeriodEnd).toLocaleDateString()
            )}
          </p>
        ) : null}

        {arrivedFromCheckout && !isSubscribed && (
          <p className="mt-4 text-sm text-ink-soft">{dict.confirming}</p>
        )}

        {error && <p className="mt-4 text-sm text-error">{error}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {!isSubscribed ? (
            <Btn variant="primary" onClick={() => runRedirectAction(createCheckoutSession)} disabled={pending}>
              {pending ? dict.subscribing : dict.subscribe}
            </Btn>
          ) : (
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => runRedirectAction(createBillingPortalSession)}
              disabled={pending}
            >
              <Icon name="externalLink" size={15} />
              {pending ? dict.opening : dict.manageBilling}
            </Btn>
          )}
        </div>
      </div>

      {isSubscribed && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold text-ink">{dict.paymentMethod.title}</h2>
          <div className="mt-3 flex items-center justify-between">
            {paymentMethod ? (
              <div className="flex items-center gap-2.5 text-ink">
                <Icon name="creditCard" size={18} className="text-ink-soft" />
                <span className="capitalize">{paymentMethod.brand}</span>
                <span className="text-ink-soft">•••• {paymentMethod.last4}</span>
              </div>
            ) : (
              <span className="text-sm text-ink-soft">{dict.paymentMethod.none}</span>
            )}
            <Btn
              variant="outline"
              size="sm"
              onClick={() => setShowPaymentMethodModal(true)}
              disabled={pending}
            >
              {dict.paymentMethod.update}
            </Btn>
          </div>
        </div>
      )}

      {isSubscribed && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold text-ink">{dict.invoices.title}</h2>

          {invoices.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">{dict.invoices.empty}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-ink-soft">
                    <th className="py-2 pr-4 font-medium">{dict.invoices.date}</th>
                    <th className="py-2 pr-4 font-medium">{dict.invoices.total}</th>
                    <th className="py-2 pr-4 font-medium">{dict.invoices.status}</th>
                    <th className="py-2 font-medium">{dict.invoices.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-4 text-ink">{formatDate(inv.date)}</td>
                      <td className="py-2.5 pr-4 text-ink">
                        {inv.total.toFixed(2)} {inv.currency}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${invoiceStatusColor(inv.status)}`}
                        >
                          {invoiceStatusLabel(inv.status, dict)}
                        </span>
                      </td>
                      <td className="py-2.5">
                        {inv.hostedInvoiceUrl ? (
                          <a
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-ink underline underline-offset-2 hover:no-underline"
                          >
                            {dict.invoices.view}
                          </a>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isSubscribed && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold text-ink">{dict.cancellation.title}</h2>

          {subscriptionDetail?.cancelAtPeriodEnd ? (
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="text-sm text-ink-soft">
                {subscriptionDetail.currentPeriodEnd
                  ? dict.cancelsOn.replace("{date}", formatDate(subscriptionDetail.currentPeriodEnd))
                  : null}
              </p>
              <Btn variant="outline" size="sm" onClick={handleResume} disabled={pending}>
                {pending ? dict.cancellation.resuming : dict.cancellation.resume}
              </Btn>
            </div>
          ) : confirmingCancel ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-ink">
                {subscriptionDetail?.currentPeriodEnd
                  ? dict.cancellation.confirmPrompt.replace(
                      "{date}",
                      formatDate(subscriptionDetail.currentPeriodEnd)
                    )
                  : dict.cancellation.confirmPrompt.replace("{date}", "")}
              </p>
              <div className="flex items-center gap-3">
                <Btn
                  variant="outline"
                  size="sm"
                  className="!border-error !text-error"
                  onClick={handleCancelConfirm}
                  disabled={pending}
                >
                  {pending ? dict.cancellation.cancelling : dict.cancellation.confirmButton}
                </Btn>
                <Btn variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)} disabled={pending}>
                  {dict.cancellation.backButton}
                </Btn>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-ink-soft">{dict.cancellation.cancelPlan}</span>
              <Btn
                variant="outline"
                size="sm"
                className="!border-error !text-error"
                onClick={() => setConfirmingCancel(true)}
              >
                {dict.cancellation.cancelPlan}
              </Btn>
            </div>
          )}
        </div>
      )}

      {showPaymentMethodModal && (
        <PaymentMethodModal
          dict={dict}
          onClose={() => setShowPaymentMethodModal(false)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}

function statusColor(status: SubscriptionStatus): string {
  switch (status) {
    case "active":
    case "trialing":
      return "bg-brand-weak text-brand-ink";
    case "past_due":
    case "unpaid":
      return "bg-error-weak text-error";
    case "cancelled":
      return "bg-surface-2 text-ink-soft";
    default:
      return "bg-surface-2 text-ink-soft";
  }
}

function invoiceStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return "bg-brand-weak text-brand-ink";
    case "open":
      return "bg-surface-2 text-ink-soft";
    case "uncollectible":
    case "void":
      return "bg-error-weak text-error";
    default:
      return "bg-surface-2 text-ink-soft";
  }
}

function invoiceStatusLabel(status: string, dict: PaymentsDictionary): string {
  const labels = dict.invoices.statusLabels;
  if (status in labels) {
    return labels[status as keyof typeof labels];
  }
  return status;
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString();
}
