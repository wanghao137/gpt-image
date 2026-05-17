/**
 * Tiny UI primitives shared across admin screens.
 *
 * Visual language is intentionally kept in lockstep with the public site
 * (`src/index.css` — `.btn-primary`, `.surface`, `.eyebrow`, `.serif-display`,
 * etc.) so the editor feels like a member of the same product family rather
 * than a generic dashboard.
 *
 * Buttons: pill-shaped, the ember primary one carries an inset top highlight
 * + a soft warm shadow that matches the public site's CTA. Forms keep
 * lower-radius (`rounded-lg`) corners — pill inputs read as "search bar" in
 * a content-heavy editor surface, which we don't want.
 */

import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  /** Renders a spinner and disables the button. */
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
  const variants: Record<string, string> = {
    primary: "btn-pill-primary",
    ghost: "btn-pill-ghost",
    danger: "btn-pill-danger",
    subtle: "btn-pill-subtle",
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${variants[variant]} ${className}`}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Field wrapper                                                       */
/* ------------------------------------------------------------------ */

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
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          {label}
          {required && <span className="ml-1 text-ember-400">*</span>}
        </span>
        {hint && (
          <span className="truncate text-[10.5px] text-ink-500">{hint}</span>
        )}
      </div>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`input-base ${className}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`input-base scrollbar-thin font-mono leading-relaxed ${className}`}
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
      className={`input-base appearance-none bg-[length:14px_14px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${className}`}
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

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

interface BadgeProps {
  tone?: "neutral" | "ember" | "emerald" | "rose";
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  const tones: Record<string, string> = {
    neutral: "border-white/10 bg-white/[0.04] text-ink-300",
    ember: "border-ember-500/40 bg-ember-500/12 text-ember-100",
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
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

/* ------------------------------------------------------------------ */
/* Card / Surface                                                      */
/* ------------------------------------------------------------------ */

/**
 * Drop-in replacement for the public site's `.surface` class — same visual
 * weight, but exposed as a component so we can keep `<Card>` semantics in
 * the editor screens.
 */
export function Card({
  children,
  className = "",
  /** Add a subtle hover lift — used for selectable rows / clickable cards. */
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`surface ${interactive ? "surface-hover" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section heading                                                     */
/* ------------------------------------------------------------------ */

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  right,
}: SectionHeadingProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-white/[0.05] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="serif-display mt-1.5 text-[26px] leading-[1.05] text-ink-50 sm:text-[32px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-400">
            {description}
          </p>
        )}
      </div>
      {right && (
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {right}
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* SrOnly                                                              */
/* ------------------------------------------------------------------ */

/** Visible only to screen readers — used for icon-only buttons. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Brand mark                                                          */
/* ------------------------------------------------------------------ */

/**
 * Admin logo — mirrors the public site's three-stop ember gradient + ring
 * accent so the user immediately reads "this is the same product".
 */
export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative grid place-items-center rounded-xl bg-gradient-to-br from-ember-300 via-ember-500 to-ember-700 text-ink-950 shadow-ember ${className}`}
    >
      <span className="serif-display text-[15px] font-bold leading-none">A</span>
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ember-200 ring-2 ring-ink-950" />
    </span>
  );
}
