import { Bird } from "lucide-react";

export function Logo({
  size = 22,
  showText = true,
  light = false,
  onColor = false,
  tagline = false,
  className,
}: {
  size?: number;
  showText?: boolean;
  light?: boolean;
  onColor?: boolean;
  // Appends " : Kaminolabs" after the wordmark, muted/regular weight —
  // used only on the home page navbar (Acuity-style "product : company").
  tagline?: boolean;
  className?: string;
}) {
  const textColor = light || onColor ? "#fff" : "var(--color-ink)";

  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <div
        className="grid shrink-0 place-items-center rounded-[9px]"
        style={{
          width: size + 8,
          height: size + 8,
          background: onColor ? "#fff" : "var(--color-brand)",
          color: onColor ? "var(--color-brand)" : "#fff",
          boxShadow: onColor ? "none" : "0 2px 8px color-mix(in oklab, var(--color-brand) 45%, transparent)",
        }}
      >
        <Bird size={size - 4} strokeWidth={2} />
      </div>
      {showText && (
        <span
          className="font-display text-[1.05em] font-semibold tracking-tight"
          style={{ fontSize: size - 2, color: textColor }}
        >
          Kalendar
          {tagline && (
            <span
              className="font-normal"
              style={{ color: light || onColor ? "rgba(255,255,255,.7)" : "var(--color-ink-soft)" }}
            >
              {" "}: Kaminolabs
            </span>
          )}
        </span>
      )}
    </div>
  );
}
