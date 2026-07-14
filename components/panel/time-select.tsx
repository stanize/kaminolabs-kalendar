"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/ui/icon";
import { TIME_OPTIONS } from "@/lib/availability/constants";

/**
 * Time-of-day dropdown ("HH:MM", 15-min steps). Extracted from
 * availability-manager.tsx so the setup wizard and the weekly grid share one
 * implementation. Anchors the selected option near the top of the open list.
 */
export function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // When opening, anchor the selected option near the TOP of the list (with a
  // little context above it) instead of the browser-default bottom anchoring.
  useEffect(() => {
    if (!open || !listRef.current || !selectedRef.current) return;
    const list = listRef.current;
    const sel = selectedRef.current;
    list.scrollTop = Math.max(0, sel.offsetTop - 8);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-[92px] items-center justify-between rounded-[10px] border bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-all ${
          open ? "border-brand shadow-[0_0_0_3px_var(--color-brand-weak)]" : "border-line hover:border-brand-line"
        }`}
      >
        {value}
        <Icon name="chevronDown" size={14} className="text-ink-soft" />
      </button>
      {open && (
        <div
          ref={listRef}
          className="absolute z-20 mt-1 max-h-[240px] w-[92px] overflow-y-auto rounded-[10px] border border-line bg-surface py-1 shadow-[0_12px_40px_rgba(15,31,46,.12)]"
        >
          {TIME_OPTIONS.map((t) => {
            const isSel = t === value;
            return (
              <button
                key={t}
                ref={isSel ? selectedRef : undefined}
                type="button"
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1.5 text-left text-[14px] transition-colors ${
                  isSel
                    ? "bg-brand text-white"
                    : "text-ink hover:bg-brand-weak"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
