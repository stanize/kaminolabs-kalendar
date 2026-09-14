"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { claimGuestHistoryIfEligible } from "@/lib/actions/patient";
import { reportClientError } from "@/lib/report-client-error";

/**
 * Fire-and-forget on every patient-dashboard mount — see
 * claimGuestHistoryIfEligible's own comment (lib/actions/patient.ts) for
 * why this has to be a separate landing hook rather than living inside
 * provisionPatient(). Renders nothing; a cheap no-op after the first
 * successful check for this patient (claim_checked_at short-circuits it
 * server-side), so safe to mount unconditionally on every load.
 */
export function ClaimGuestHistory() {
  const router = useRouter();

  useEffect(() => {
    claimGuestHistoryIfEligible()
      .then((result) => { if (result.linked) router.refresh(); })
      .catch((e) => reportClientError("claimGuestHistoryIfEligible", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
