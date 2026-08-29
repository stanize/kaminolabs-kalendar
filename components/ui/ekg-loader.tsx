/**
 * EKG-style pulse-line loading indicator — a heartbeat waveform that draws
 * itself in a continuous loop (via the .ekg-pulse-line animation in
 * app/globals.css), rather than a plain spinner. Kept in Kalendar's normal
 * light theme + brand teal, not a separate dark "clinical" look.
 */
export function EkgLoader({ width = 160, height = 40 }: { width?: number; height?: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 300 60"
      fill="none"
      role="img"
      aria-label="Cargando"
    >
      <path
        d="M0,30 L95,30 L110,12 L125,48 L140,18 L150,30 L300,30"
        stroke="var(--color-brand)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ekg-pulse-line"
      />
    </svg>
  );
}
