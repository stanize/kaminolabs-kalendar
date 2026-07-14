"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

export type SaveOverlayState = "saving" | "success" | null;

/** How long the success flash stays visible before the follow-up runs. */
export const SUCCESS_FLASH_MS = 900;

/**
 * Shared state + flash helper for the panel save overlay.
 *
 * Usage in a save handler:
 *   setOverlay("saving")           → before the server action
 *   setOverlay(null)               → on any error path
 *   flashSuccessThen(() => { … })  → on success; shows the flash, then runs
 *                                    the follow-up (redirect or refresh)
 *
 * When the follow-up redirects (router.push), do NOT clear the overlay —
 * leave it up so it covers the page until navigation unmounts the component.
 * Only clear it (setOverlay(null)) when staying on the page (router.refresh).
 */
export function useSaveOverlay() {
  const [overlay, setOverlay] = useState<SaveOverlayState>(null);

  function flashSuccessThen(after: () => void) {
    setOverlay("success");
    window.setTimeout(after, SUCCESS_FLASH_MS);
  }

  return { overlay, setOverlay, flashSuccessThen };
}

/**
 * Full-screen save overlay used across the panel setup pages (Servicios,
 * Negocio, Equipo, Disponibilidad): grays out and blocks the page while a
 * save is in flight, then flashes a success confirmation before the
 * redirect/refresh runs. Renders nothing when state is null.
 */
export function SaveOverlay({
  state,
  savingLabel,
  successLabel,
}: {
  state: SaveOverlayState;
  savingLabel: string;
  successLabel: string;
}) {
  if (!state) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/30 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-5 shadow-lg">
        {state === "saving" ? (
          <>
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand"
              aria-hidden
            />
            <span className="text-[14px] font-semibold text-ink">{savingLabel}</span>
          </>
        ) : (
          <>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-white">
              <Icon name="check" size={14} strokeWidth={3} />
            </span>
            <span className="text-[14px] font-semibold text-ink">{successLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
