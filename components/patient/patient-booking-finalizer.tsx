"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { finalizeVerifiedPatientBookings } from "@/lib/actions/patient";
import { reportClientError } from "@/lib/report-client-error";

/**
 * Silently promotes any pending_confirmation bookings the patient has to
 * confirmed, the moment their session shows emailVerified: true — this is
 * the "no loss" half of the email-verification requirement (see
 * lib/actions/patient.ts's finalizeVerifiedPatientBookings doc comment).
 * Mounted unconditionally on the dashboard (see page.tsx) — cheap/no-op
 * once nothing's left to promote, so it's safe to call on every visit
 * rather than needing a precise "just verified" signal from the callback
 * redirect. Renders nothing.
 */
export function PatientBookingFinalizer() {
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    finalizeVerifiedPatientBookings()
      .then((result) => {
        if (result.confirmedCount > 0) router.refresh();
      })
      .catch((e) => {
        reportClientError("finalizeVerifiedPatientBookings", e);
      });
  }, [router]);

  return null;
}
