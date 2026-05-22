import { useId } from "react";
import { BRAND } from "../lib/brand";

interface PeachLogoMarkProps {
  className?: string;
  title?: string;
  decorative?: boolean;
}

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showEnglish?: boolean;
  compact?: boolean;
}

export function PeachLogoMark({
  className = "h-9 w-9",
  title = BRAND.name,
  decorative = true,
}: PeachLogoMarkProps) {
  const uid = useId().replace(/:/g, "");
  const peachGradient = `${uid}-peach`;
  const leafGradient = `${uid}-leaf`;

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {!decorative && <title>{title}</title>}
      <defs>
        <linearGradient id={peachGradient} x1="9" y1="10" x2="55" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff7569" />
          <stop offset="55%" stopColor="#ff9b48" />
          <stop offset="100%" stopColor="#ea7341" />
        </linearGradient>
        <linearGradient id={leafGradient} x1="37" y1="20" x2="58" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#557f5c" />
          <stop offset="100%" stopColor="#9dcb8b" />
        </linearGradient>
      </defs>

      <path
        d="M31.8 58.1C18.2 58.1 7.6 48.4 7.6 35.1 7.6 22 17.5 10.8 29.4 10.8c4.8 0 8.4 1.7 10.8 4.8 2.3-2.5 5.5-3.8 9.1-3.1 7.3 1.3 11.7 8.5 11.7 17.2 0 15.5-12.4 28.4-29.2 28.4Z"
        fill={`url(#${peachGradient})`}
      />
      <path
        d="M39.1 18.9C42.9 8.5 50 4.3 58.4 5.3c-.7 8.8-7.7 15.7-18.6 15.9-.9 0-1.2-.5-.7-2.3Z"
        fill={`url(#${leafGradient})`}
      />
    </svg>
  );
}

export function BrandLogo({
  className = "",
  markClassName = "h-9 w-9",
  textClassName = "",
  showEnglish = false,
  compact = false,
}: BrandLogoProps) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`.trim()}>
      <PeachLogoMark className={`shrink-0 ${markClassName}`.trim()} />
      <span className={`min-w-0 leading-none ${textClassName}`.trim()}>
        <span className="block truncate text-[15px] font-semibold tracking-tight text-ink-50">
          {compact ? BRAND.shortName : BRAND.name}
        </span>
        {showEnglish && (
          <span className="mt-1 block truncate text-[11px] font-medium tracking-[0.16em] text-ink-400">
            {BRAND.latinName}
          </span>
        )}
      </span>
    </span>
  );
}
