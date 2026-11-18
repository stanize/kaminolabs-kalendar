"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { InvoicingDictionary } from "@/lib/i18n/dictionaries/invoicing";

export interface PreviewMemberOption {
  id: string;
  name: string;
}

/**
 * invoice-preview (pdf-invoicing.md): side panel showing a sample invoice
 * (made-up client/service, "EJEMPLO" watermark) built from the clinic's
 * current saved settings. The practitioner dropdown picks whose title,
 * colegiada number and signature are shown; the default is the current
 * user (the owner's own team-member row), passed in as `defaultMemberId`.
 */
export function InvoicePreviewPanel({
  members,
  defaultMemberId,
  dict,
  onClose,
}: {
  members: PreviewMemberOption[];
  defaultMemberId: string | null;
  dict: InvoicingDictionary["settings"];
  onClose: () => void;
}) {
  const [memberId, setMemberId] = useState(defaultMemberId ?? members[0]?.id ?? "");

  // side-panel-pattern — same shell/transition as every other panel.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const closingRef = useRef(false);
  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const src = `/api/invoices/preview${memberId ? `?member=${encodeURIComponent(memberId)}` : ""}`;

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 md:left-[240px]">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={requestClose}
        aria-hidden
      />
      <div
        className={`absolute inset-y-0 right-0 flex h-full w-full flex-col bg-surface p-5 shadow-2xl transition-transform duration-200 ease-out sm:w-[min(760px,90%)] sm:p-8 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-ink">{dict.previewPanelTitle}</h2>
          <button
            onClick={requestClose}
            aria-label={dict.previewClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <p className="mb-3 text-[12.5px] text-ink-soft">{dict.previewHint}</p>

        {members.length > 1 && (
          <label className="mb-3 flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ink-soft">{dict.previewPractitionerLabel}</span>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* key forces a fresh load when the practitioner changes */}
        <iframe
          key={memberId}
          src={src}
          title={dict.previewPanelTitle}
          className="min-h-0 w-full flex-1 rounded-lg border border-line bg-surface-2"
        />
      </div>
    </div>
  );
}
