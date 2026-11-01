"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const SLOT_ID = "availability-header-action";

/**
 * Portal target rendered by AvailabilityLayout (server component) next to
 * the page title. Each tab's manager (FestivosManager, TimeOffManager,
 * CustomTimeSlotsManager) portals its own "+ Añadir" button into this slot
 * via AvailabilityHeaderAction below, so the button sits on the shared
 * title row instead of inside the tab content (2026-11-01, per Arun's
 * mockup).
 */
export function AvailabilityHeaderSlot() {
  return <div id={SLOT_ID} className="shrink-0" />;
}

export function AvailabilityHeaderAction({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => {
    // Standard portal-mount pattern: the target DOM node only exists once
    // this effect runs (it's server-rendered by AvailabilityLayout, so it's
    // already in the DOM by the time this mounts, but can't be looked up
    // during SSR itself) — a legitimate exception to "don't setState in an
    // effect", not a derivable-from-render value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget(document.getElementById(SLOT_ID));
  }, []);
  if (!target) return null;
  return createPortal(children, target);
}
