"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

// A small PDF viewer drawn onto <canvas> elements with pdf.js, used by the
// generate-invoice panel's LIVE preview (pdf-invoicing.md,
// invoice-edit-before-generate). The browser's built-in PDF viewer reloads
// every time its source changes — a blank flash and a scroll reset on every
// keystroke. Here the pages are drawn off-screen and swapped in only once
// ready, inside a scroll area WE own, so the scroll position and zoom
// survive updates and the preview just changes in place. It also behaves
// the same on every browser, phones and tablets included.
//
// pdf.js is loaded lazily (dynamic import) the first time a viewer mounts, so
// it is not part of any other page's bundle.

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((m) => {
    // The worker is bundled as a static asset by Next (the `new URL(...,
    // import.meta.url)` form is what the bundler recognises).
    m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return m;
  });
  return pdfjsPromise;
}

const PAGE_PADDING_PX = 12;
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

export interface PdfCanvasViewerLabels {
  zoomIn: string;
  zoomOut: string;
  fit: string;
}

export function PdfCanvasViewer({
  data,
  labels,
  className = "",
}: {
  /** The PDF's bytes. A new value redraws the pages in place. */
  data: ArrayBuffer | null;
  labels: PdfCanvasViewerLabels;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  // Bumped whenever a new document is ready, to trigger a redraw.
  const [docVersion, setDocVersion] = useState(0);
  // 1 = page fits the panel's width.
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  // Set when the redraw is only a zoom/resize, so the scroll position can be
  // kept proportionally. A NEW document keeps the absolute scroll instead.
  const keepScrollRatioRef = useRef(false);

  // Track the scroll area's width (fit-to-width follows the panel).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(() => {
      keepScrollRatioRef.current = true;
      update();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load the document whenever new bytes arrive.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      const pdfjs = await loadPdfJs();
      // pdf.js hands the buffer to its worker (detaching it), so give it a copy.
      const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
      if (cancelled) {
        void doc.destroy();
        return;
      }
      const previous = docRef.current;
      docRef.current = doc;
      keepScrollRatioRef.current = false;
      setDocVersion((v) => v + 1);
      if (previous) void previous.destroy();
    })().catch(() => {
      /* a failed load leaves the previous pages showing */
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  // Draw the pages off-screen, then swap them in all at once.
  useEffect(() => {
    const doc = docRef.current;
    const host = pagesRef.current;
    const scroller = scrollRef.current;
    if (!doc || !host || !scroller || width <= 0) return;

    let cancelled = false;
    const tasks: RenderTask[] = [];
    (async () => {
      const dpr = window.devicePixelRatio || 1;
      const canvases: HTMLCanvasElement[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const cssScale = ((width - PAGE_PADDING_PX * 2) / base.width) * zoom;
        const viewport = page.getViewport({ scale: cssScale * dpr });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        canvas.className = "mx-auto mb-3 block max-w-none bg-white shadow";
        const task = page.render({ canvas, viewport });
        tasks.push(task);
        await task.promise;
        canvases.push(canvas);
      }
      if (cancelled) return;
      const ratio = scroller.scrollHeight > 0 ? scroller.scrollTop / scroller.scrollHeight : 0;
      host.replaceChildren(...canvases);
      if (keepScrollRatioRef.current) scroller.scrollTop = ratio * scroller.scrollHeight;
    })().catch(() => {
      /* a cancelled or failed draw leaves the previous pages showing */
    });

    return () => {
      cancelled = true;
      for (const t of tasks) t.cancel();
    };
  }, [docVersion, zoom, width]);

  useEffect(
    () => () => {
      const doc = docRef.current;
      docRef.current = null;
      if (doc) void doc.destroy();
    },
    []
  );

  function changeZoom(next: number) {
    keepScrollRatioRef.current = true;
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)));
  }

  const btn =
    "grid h-7 min-w-7 place-items-center rounded-md border border-line bg-surface px-2 text-[13px] font-semibold text-ink hover:bg-surface-2 disabled:opacity-40";

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="mb-2 flex items-center justify-end gap-1.5">
        <button type="button" className={btn} aria-label={labels.zoomOut} onClick={() => changeZoom(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN}>
          −
        </button>
        <button type="button" className={btn} onClick={() => changeZoom(1)}>
          {labels.fit}
        </button>
        <button type="button" className={btn} aria-label={labels.zoomIn} onClick={() => changeZoom(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX}>
          +
        </button>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-surface-2 p-3">
        <div ref={pagesRef} />
      </div>
    </div>
  );
}
