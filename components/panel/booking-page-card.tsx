"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";

export function BookingPageCard({
  slug,
  bookingPath,
  bookingUrl,
  title,
  viewPageLabel,
  downloadQrLabel,
  qrModalTitle,
  closeLabel,
}: {
  slug: string;
  bookingPath: string;
  bookingUrl: string;
  title: string;
  viewPageLabel: string;
  downloadQrLabel: string;
  qrModalTitle: string;
  closeLabel: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(bookingUrl, {
      width: 640,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then((url) => { if (!cancelled) setQrDataUrl(url); });
    return () => { cancelled = true; };
  }, [bookingUrl]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-${slug}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
        {title}
      </p>
      <Link
        href={bookingPath}
        target="_blank"
        className="inline-flex items-center gap-1.5 text-[14.5px] font-bold text-brand hover:underline"
      >
        {viewPageLabel}
        <Icon name="externalLink" size={14} />
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => qrDataUrl && setShowModal(true)}
          aria-label={downloadQrLabel}
          className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-white hover:border-brand-line"
        >
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- small client-generated data: URL, no benefit from next/image
            <img src={qrDataUrl} alt={qrModalTitle} className="h-full w-full" />
          ) : (
            <div className="h-full w-full animate-pulse bg-surface-2" />
          )}
        </button>
        <button
          onClick={() => qrDataUrl && setShowModal(true)}
          className="text-[13px] font-medium text-ink-soft hover:text-ink"
        >
          {downloadQrLabel}
        </button>
      </div>

      {showModal && qrDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-[360px] rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-ink">{qrModalTitle}</h2>
              <button
                onClick={() => setShowModal(false)}
                aria-label={closeLabel}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- small client-generated data: URL, no benefit from next/image */}
            <img src={qrDataUrl} alt={qrModalTitle} className="mx-auto h-64 w-64 rounded-lg border border-line" />
            <p className="mt-3 truncate text-center text-[12.5px] text-ink-soft">{bookingUrl}</p>
            <Btn variant="outline" size="sm" full className="mt-4" onClick={handleDownload}>
              <Icon name="qrCode" size={14} /> {downloadQrLabel}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
