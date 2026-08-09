"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelBookingAsPatient } from "@/lib/actions/patient";

// Small filled pill — same shape/weight as the "Guardar cambios" button
// elsewhere in the portal, just scaled down for an inline row action. Red
// fill (bg-error) deliberately breaks from the portal's standard brand
// teal, since this is a destructive action and should read differently at
// a glance from "Pedir nueva cita".
const pillBase =
  "rounded-full px-3 py-1.5 text-[12px] font-semibold text-white transition-colors disabled:opacity-60";

export function PatientCancelButton({
  bookingId,
  labels,
  onCancelled,
}: {
  bookingId: string;
  labels: {
    cancel: string;
    confirm: string;
    cancelling: string;
    keep: string;
  };
  // Called immediately on success so the parent can flip its local status to
  // "cancelled" without waiting on a server round-trip / page reload.
  onCancelled: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await cancelBookingAsPatient(bookingId);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      onCancelled();
      router.refresh();
    } catch {
      setError("No se pudo cancelar la reserva.");
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`${pillBase} bg-error hover:brightness-95`}
          >
            {busy ? labels.cancelling : labels.confirm}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            {labels.keep}
          </button>
        </div>
        {error && <p className="text-[11.5px] text-error">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`${pillBase} shrink-0 bg-error hover:brightness-95`}
    >
      {labels.cancel}
    </button>
  );
}
