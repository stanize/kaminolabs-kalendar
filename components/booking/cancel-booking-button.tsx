"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { cancelBookingByToken } from "@/lib/actions/booking";
import type { BookingResultDictionary } from "@/lib/i18n/dictionaries/booking-result";

export function CancelBookingButton({
  token,
  dict,
}: {
  token: string;
  dict: BookingResultDictionary["cancel"];
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setError(null);
    setBusy(true);
    try {
      const res = await cancelBookingByToken(token);
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError(dict.errUnexpected);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-weak text-brand">
          <Icon name="check" size={22} strokeWidth={2.5} />
        </div>
        <p className="text-[14.5px] font-semibold text-ink">{dict.doneTitle}</p>
        <p className="text-[13px] text-ink-soft">{dict.doneBody}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-left text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Btn onClick={cancel} disabled={busy} full>
        {busy ? dict.cancelling : dict.confirmButton}
      </Btn>
    </div>
  );
}
