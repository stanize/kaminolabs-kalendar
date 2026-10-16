"use client";

import { useRef, useState } from "react";
import { Btn } from "@/components/ui/button";

// draw-signature (pdf-invoicing.md) — a canvas-based pad so a clinic can
// sign with a mouse/trackpad/touchscreen/stylus instead of only uploading
// an existing image file. Works via Pointer Events, which unify mouse,
// touch and pen on both desktop and mobile with one code path. The result
// is exported as a transparent PNG File, same shape uploadInvoiceSignature
// already expects from the file-upload path, so both share one action.
export function SignaturePad({
  onSave,
  onCancel,
  saving,
  dict,
}: {
  onSave: (file: File) => void;
  onCancel: () => void;
  saving: boolean;
  dict: {
    hint: string;
    clear: string;
    save: string;
    cancel: string;
    errEmpty: string;
  };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getContext() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }

  // Lazily sizes the canvas's backing store to its displayed CSS size *
  // devicePixelRatio, so strokes stay crisp on high-DPI screens. Safe to
  // call on every pointer-down since it's a no-op once already sized.
  function ensureCanvasSized() {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const targetW = Math.round(canvas.clientWidth * ratio);
    const targetH = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#111827";
    }
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    ensureCanvasSized();
    const ctx = getContext();
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setError(null);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setError(null);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      setError(dict.errEmpty);
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      onSave(new File([blob], "signature.png", { type: "image/png" }));
    }, "image/png");
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="h-[140px] w-full touch-none rounded-xl border border-line bg-surface-2/40"
      />
      <p className="text-[12px] text-ink-soft">{dict.hint}</p>
      {error && <p className="text-[12.5px] text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <Btn variant="outline" size="sm" type="button" onClick={handleClear} disabled={saving}>
          {dict.clear}
        </Btn>
        <Btn size="sm" type="button" onClick={handleSave} disabled={saving}>
          {dict.save}
        </Btn>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-[12.5px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
        >
          {dict.cancel}
        </button>
      </div>
    </div>
  );
}
