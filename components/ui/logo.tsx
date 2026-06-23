import { Calendar } from "lucide-react";

export function Logo({
  size = 22,
  showText = true,
  light = false,
  onColor = false,
  className,
}: {
  size?: number;
  showText?: boolean;
  light?: boolean;
  onColor?: boolean;
  className?: string;
}) {
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
        <Calendar size={size - 4} strokeWidth={2} />
      </div>
      {showText && (
        <span
          className="font-display text-[1.05em] font-semibold tracking-tight"
          style={{
            fontSize: size - 2,
            color: light || onColor ? "#fff" : "var(--color-ink)",
          }}
        >
          Kalendar
        </span>
      )}
    </div>
  );
}
