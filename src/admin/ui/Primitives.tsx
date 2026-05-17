/**
 * Tiny UI primitives shared across admin screens.
 * Kept inline (no separate folder explosion) — easier to evolve in one place.
 */

import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "ghost",
  loading,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<string, string> = {
    primary:
      "bg-ember-500 text-ink-950 hover:bg-ember-400 shadow-[0_8px_24px_-12px_rgba(217,119,87,0.6)]",
    ghost:
      "border border-white/10 bg-white/[0.03] text-ink-100 hover:border-white/25 hover:bg-white/[0.06]",
    danger:
      "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:border-rose-400/50 hover:bg-rose-500/20",
    subtle:
      "text-ink-400 hover:text-ink-50",
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

interface FieldProps {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, required, children, className = "" }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          {label}
          {required && <span className="ml-1 text-ember-400">*</span>}
        </span>
        {hint && <span className="text-[11px] text-ink-500">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-white/[0.08] bg-ink-950/40 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-ember-500/50 focus:ring-2 focus:ring-ember-500/15";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${inputBase} ${className}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`${inputBase} font-mono leading-relaxed scrollbar-thin ${className}`}
    />
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  className?: string;
}

export function Select({ value, onChange, options, className = "" }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} appearance-none bg-[length:14px_14px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='%237a746c'%3E%3Cpath d='m2 4 4 4 4-4z'/%3E%3C/svg%3E\")",
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-ink-900 text-ink-100">
          {opt}
        </option>
      ))}
    </select>
  );
}

interface BadgeProps {
  tone?: "neutral" | "ember" | "emerald" | "rose";
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  const tones: Record<string, string> = {
    neutral: "border-white/10 bg-white/[0.04] text-ink-300",
    ember: "border-ember-500/40 bg-ember-500/12 text-ember-100",
    emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    rose: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
}

export function SectionHeading({ eyebrow, title, description, right }: SectionHeadingProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-white/[0.05] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-400">
            {eyebrow}
          </p>
        )}
        <h1 className="serif-display mt-1 text-2xl text-ink-50 sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-400">
            {description}
          </p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}

/** Visible only to screen readers — used for icon-only buttons. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
