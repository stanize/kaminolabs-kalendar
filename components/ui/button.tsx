import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "soft" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  children: ReactNode;
}

const SIZES: Record<Size, string> = {
  sm: "px-3.5 py-2 text-[13.5px]",
  md: "px-[18px] py-[11px] text-[15px]",
  lg: "px-6 py-[14px] text-[16px]",
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_1px_2px_rgba(15,23,42,.08)] hover:brightness-[1.06] hover:-translate-y-px hover:shadow-[0_4px_14px_color-mix(in_oklab,var(--color-brand)_35%,transparent)]",
  soft: "bg-brand-weak text-brand-ink border border-brand-line hover:brightness-[.98]",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-2",
  outline: "bg-surface text-ink border border-line hover:border-brand-line hover:text-brand",
};

export function Btn({
  variant = "primary",
  size = "md",
  full,
  className,
  disabled,
  children,
  ...rest
}: BtnProps) {
  return (
    <button
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent font-ui font-semibold transition-all duration-150",
        SIZES[size],
        VARIANTS[variant],
        full && "w-full",
        disabled ? "cursor-not-allowed opacity-50 hover:translate-y-0 hover:shadow-none hover:brightness-100" : "cursor-pointer",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
