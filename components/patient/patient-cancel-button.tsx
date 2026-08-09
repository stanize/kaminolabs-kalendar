"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
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
  serviceName,
  businessName,
  whenLabel,
  labels,
  onCancelled,
}: {
  bookingId: string;
  // Shown inside the confirmation modal so it's unmistakable which
  // appointment is being cancelled — previously the confirm/keep buttons
  // appeared inline next to "Pedir nueva cita" with no booking context,
  // which read as ambiguous about what was actually being confirmed.
  serviceName: string;
  businessName: string;
  whenLabel: string;
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
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError("No se pudo cancelar la reserva.");
      setBusy(false);
    }
  }

  function handleClose() {
    if (busy) return;
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${pillBase} shrink-0 bg-error hover:brightness-95`}
      >
        {labels.cancel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-[380px] rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-error-weak text-error">
                <Icon name="x" size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-ink">¿Cancelar esta cita?</h2>
                <p className="mt-0.5 text-[13.5px] text-ink-soft">
                  Esta acción no se puede deshacer. Se avisará a la clínica.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
              <p className="text-[13.5px] font-semibold text-ink">{serviceName}</p>
              <p className="text-[12.5px] text-ink-soft">
                {businessName} · {whenLabel}
              </p>
            </div>

            {error && (
              <p className="mb-3 text-[13px] text-error">{error}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className={`${pillBase} flex-1 !rounded-lg bg-error py-2.5 text-[13.5px] hover:brightness-95`}
              >
                {busy ? labels.cancelling : labels.confirm}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="flex-1 rounded-lg border border-line px-3 py-2.5 text-[13.5px] font-semibold text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-60"
              >
                {labels.keep}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
