export function Avatar({ nombre, size = 40 }: { nombre: string; size?: number }) {
  const inicial =
    (nombre || "?")
      .trim()
      .split(/\s+/)
      .map((x) => x[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-display font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: "color-mix(in oklab, var(--color-brand) 16%, white)",
        color: "var(--color-brand-ink)",
      }}
    >
      {inicial}
    </div>
  );
}
