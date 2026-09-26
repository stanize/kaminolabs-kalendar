"use client";

import { Btn } from "@/components/ui/button";
import type { ConflictSummary } from "@/lib/actions/closures";
import type { ClosureConflictDictionary } from "@/lib/i18n/dictionaries/closure-conflict";

const TZ = "Europe/Madrid";

function formatWhen(iso: string, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, {
    timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

/**
 * Shared existing-bookings-conflict-alert dialog — shown by both
 * FestivosManager and TimeOffList when createFestivo/createTimeOff report
 * `needsConfirmation` instead of saving. Purely informational + a save
 * gate: confirming re-calls the same create action with `confirmed: true`;
 * no affected booking is touched by this dialog itself.
 */
export function ClosureConflictDialog({
  conflicts,
  intlLocale,
  dict,
  saving,
  onCancel,
  onConfirm,
}: {
  conflicts: ConflictSummary;
  intlLocale: string;
  dict: ClosureConflictDictionary;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const extra = conflicts.total - conflicts.sample.length;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onClick={onCancel}>
      <div
        className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold text-ink">
          {dict.title.replace("{count}", String(conflicts.total))}
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-soft">{dict.description}</p>

        <div className="mt-3 flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">
          {conflicts.sample.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink">{b.clientName}</p>
                <p className="truncate text-[12px] text-ink-soft">
                  {b.serviceName}
                  {b.providerName ? ` · ${b.providerName}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[12px] text-ink-soft">{formatWhen(b.startIso, intlLocale)}</span>
            </div>
          ))}
          {extra > 0 && (
            <p className="px-1 text-[12px] text-ink-soft">{dict.moreLabel.replace("{n}", String(extra))}</p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onCancel} disabled={saving}>
            {dict.cancel}
          </Btn>
          <Btn
            variant="outline"
            onClick={onConfirm}
            disabled={saving}
            className="!border-error !text-error hover:!bg-error-weak"
          >
            {saving ? dict.saving : dict.confirm}
          </Btn>
        </div>
      </div>
    </div>
  );
}
