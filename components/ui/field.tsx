import type { InputHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: boolean;
}

export function inputClasses(error?: boolean) {
  return clsx(
    "w-full rounded-[10px] border bg-surface px-[13px] py-3 text-[15px] text-ink outline-none transition-all duration-150",
    "placeholder:text-ink-soft/60",
    error
      ? "border-error shadow-[0_0_0_3px_var(--color-error-weak)]"
      : "border-line focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)]"
  );
}

export function Field({ label, hint, error, className, ...rest }: FieldProps) {
  return (
    <label className="flex flex-col gap-[7px]">
      <span className="text-[13px] font-semibold text-ink">
        {label} {hint && <em className="font-medium not-italic text-ink-soft">{hint}</em>}
      </span>
      <input className={clsx(inputClasses(error), className)} {...rest} />
    </label>
  );
}
