"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ensureTrialSubscription } from "@/lib/actions/billing";

/**
 * Fires ensureTrialSubscription once, silently, when mounted. Rendered by
 * app/panel/page.tsx ONLY when setup is 100% complete (allDone) and the
 * business has no subscription yet — this is Arun's "everyone gets the
 * free trial by default" decision: no button, no choice screen, it just
 * happens the moment onboarding finishes. Renders nothing.
 *
 * useRef (not just relying on the effect's empty deps) guards against
 * React 18 Strict Mode's intentional double-invoke of effects in dev,
 * which would otherwise fire this twice on a single mount — the server
 * action itself is also idempotent (checks for an existing
 * stripe_subscription_id first), so this is a belt-and-suspenders guard,
 * not the only protection against double-provisioning.
 */
export function AutoTrialProvisioner() {
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    ensureTrialSubscription()
      .then((result) => {
        if (result.ok && result.created) {
          // Refresh so the panel picks up the new subscription_status
          // (e.g. any trial banner elsewhere) without a manual reload.
          router.refresh();
        }
      })
      .catch(() => {
        // Silent — this is a background convenience action, not something
        // that should surface an error to a clinic mid-onboarding. Worst
        // case, the trial simply doesn't start automatically and the
        // clinic can still start one manually from Suscripción settings.
      });
  }, [router]);

  return null;
}
