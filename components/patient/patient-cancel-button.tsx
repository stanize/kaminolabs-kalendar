"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cancelBookingAsPatient } from "@/lib/actions/patient";

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
            className="rounded-lg bg-error px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:brightness-95 disabled:opacity-60"
          >
            {busy ? labels.cancelling : labels.confirm}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:bg-surface-2"
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
      className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:bg-error-weak hover:text-error"
      aria-label={labels.cancel}
    >
      <Icon name="x" size={13} />
      {labels.cancel}
    </button>
  );
}
