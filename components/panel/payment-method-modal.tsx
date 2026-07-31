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
import { createSetupIntent, setDefaultPaymentMethod, createBillingPortalSession } from "@/lib/actions/billing";
import type { PaymentsDictionary } from "@/lib/i18n/dictionaries/payments";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const STRIPE_LOAD_TIMEOUT_MS = 8000;

interface Props {
  dict: PaymentsDictionary;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * In-app card-update modal — replaces the earlier redirect-to-Stripe-portal
 * approach, per Arun's request to match an in-app flow like Claude.ai's own
 * "Payment method" modal. Card entry itself still happens inside Stripe's
 * own iframe (Elements/PaymentElement), so raw card data never touches
 * Kalendar's servers — only the resulting SetupIntent/PaymentMethod id does.
 */
export function PaymentMethodModal({ dict, onClose, onSuccess }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallingBack, setFallingBack] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Same Bitwarden/ad-blocker-can-silently-block-js.stripe.com guard as
      // subscribe-modal.tsx — see that file for the full explanation. No
      // Checkout-equivalent exists for a scoped card-only update, so this
      // falls back to the general Customer Portal link instead.
      const stripe = stripePromise
        ? await Promise.race([
            stripePromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), STRIPE_LOAD_TIMEOUT_MS)),
          ]).catch(() => null)
        : null;

      if (cancelled) return;

      if (!stripe) {
        setFallingBack(true);
        const fallback = await createBillingPortalSession();
        if (cancelled) return;
        if (fallback.ok) {
          window.location.href = fallback.url;
        } else {
          setFallingBack(false);
          setError(dict.errUnexpected);
        }
        return;
      }

      const result = await createSetupIntent();
      if (cancelled) return;
      if (result.ok) {
        setClientSecret(result.clientSecret);
      } else {
        setError(result.error);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [dict.errUnexpected]);

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
          <h2 className="text-[17px] font-bold text-ink">{dict.paymentMethod.title}</h2>
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
          <p className="text-sm text-ink-soft">{dict.opening}</p>
        ) : !clientSecret ? (
          <p className="text-sm text-ink-soft">{dict.opening}</p>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <PaymentMethodForm dict={dict} onClose={onClose} onSuccess={onSuccess} />
          </Elements>
        )}
      </div>
    </div>
  );
}

function PaymentMethodForm({
  dict,
  onClose,
  onSuccess,
}: {
  dict: PaymentsDictionary;
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

    // redirect: "if_required" keeps this in-app — Stripe only navigates away
    // if the card issuer itself requires an out-of-band 3D Secure challenge,
    // which isn't something Kalendar controls.
    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? dict.errUnexpected);
      setSubmitting(false);
      return;
    }

    const paymentMethodId =
      typeof setupIntent?.payment_method === "string" ? setupIntent.payment_method : null;

    if (!paymentMethodId) {
      setError(dict.errUnexpected);
      setSubmitting(false);
      return;
    }

    const result = await setDefaultPaymentMethod(paymentMethodId);
    setSubmitting(false);

    if (result.ok) {
      onSuccess();
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />

      {error && <p className="mt-3 text-sm text-error">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <Btn variant="primary" disabled={!stripe || submitting} className="flex-1">
          {submitting ? dict.opening : dict.paymentMethod.update}
        </Btn>
        <Btn type="button" variant="ghost" onClick={onClose} disabled={submitting}>
          {dict.cancellation.backButton}
        </Btn>
      </div>
    </form>
  );
}
