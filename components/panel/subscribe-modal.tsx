"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { createSubscriptionIntent, createCheckoutSession } from "@/lib/actions/billing";
import type { PaymentsDictionary } from "@/lib/i18n/dictionaries/payments";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface Props {
  dict: PaymentsDictionary;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * In-app subscribe modal — replaces the redirect to Stripe's hosted
 * Checkout page, matching the same in-app pattern as
 * payment-method-modal.tsx, per Arun's request to bring the initial
 * subscribe flow into the modal too. Card entry still happens inside
 * Stripe's own iframe (Elements), never touching Kalendar's servers.
 */
export function SubscribeModal({ dict, onClose, onSuccess }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [mode, setMode] = useState<"payment" | "setup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallingBack, setFallingBack] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createSubscriptionIntent().then(async (result) => {
      if (cancelled) return;
      if (result.ok) {
        setClientSecret(result.clientSecret);
        setMode(result.mode);
        return;
      }

      // In-app intent creation failed — fall back to the known-working
      // Checkout redirect rather than dead-ending the person on an error.
      // This is a temporary safety net while the underlying cause (Stripe
      // not returning a usable PaymentIntent/SetupIntent client secret for
      // some accounts/subscriptions) is investigated — see MODULES.md.
      setFallingBack(true);
      const fallback = await createCheckoutSession();
      if (cancelled) return;
      if (fallback.ok) {
        window.location.href = fallback.url;
      } else {
        setFallingBack(false);
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const appearance = useMemo(
    () => ({
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#0d9488",
        colorBackground: "#ffffff",
        colorText: "#0f1f2e",
        colorDanger: "#e0506a",
        borderRadius: "10px",
        fontFamily: "inherit",
      },
    }),
    []
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-ink">{dict.subscribe}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">
            {error}
          </div>
        )}

        {!stripePromise ? (
          <p className="text-sm text-ink-soft">{dict.errUnexpected}</p>
        ) : fallingBack ? (
          <p className="text-sm text-ink-soft">{dict.subscribing}</p>
        ) : !clientSecret || !mode ? (
          <p className="text-sm text-ink-soft">{dict.opening}</p>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <SubscribeForm dict={dict} mode={mode} onClose={onClose} onSuccess={onSuccess} />
          </Elements>
        )}
      </div>
    </div>
  );
}

function SubscribeForm({
  dict,
  mode,
  onClose,
  onSuccess,
}: {
  dict: PaymentsDictionary;
  mode: "payment" | "setup";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    // mode determines which confirm call matches the client secret we were
    // given: 'payment' for a real first charge, 'setup' for a $0 first
    // invoice (discount phase) where there's nothing to charge yet but a
    // card still needs to be collected and saved for later. See
    // createSubscriptionIntent in lib/actions/billing.ts.
    const { error: confirmError } =
      mode === "payment"
        ? await stripe.confirmPayment({ elements, redirect: "if_required" })
        : await stripe.confirmSetup({ elements, redirect: "if_required" });

    setSubmitting(false);

    if (confirmError) {
      setError(confirmError.message ?? dict.errUnexpected);
      return;
    }

    onSuccess();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />

      {error && <p className="mt-3 text-sm text-error">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <Btn variant="primary" disabled={!stripe || submitting} className="flex-1">
          {submitting ? dict.subscribing : dict.subscribe}
        </Btn>
        <Btn type="button" variant="ghost" onClick={onClose} disabled={submitting}>
          {dict.cancellation.backButton}
        </Btn>
      </div>
    </form>
  );
}
