"use client";

import { useState } from "react";
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
}: {
  slug: string;
  bookingPath: string;
  bookingUrl: string;
  title: string;
  viewPageLabel: string;
  downloadQrLabel: string;
}) {
  const [generating, setGenerating] = useState(false);

  const handleDownloadQr = async () => {
    setGenerating(true);
    try {
      const dataUrl = await QRCode.toDataURL(bookingUrl, {
        width: 800,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setGenerating(false);
    }
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

      <div className="mt-3">
        <Btn variant="outline" size="sm" full onClick={handleDownloadQr} disabled={generating}>
          <Icon name="qrCode" size={14} />
          {downloadQrLabel}
        </Btn>
      </div>
    </div>
  );
}
