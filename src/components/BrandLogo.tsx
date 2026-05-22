import { BRAND } from "../lib/brand";

const PEACH_LOGO_SRC = "/brand/taostudio-peach-logo-256.png";
const PEACH_LOGO_SRC_SET = [
  "/brand/taostudio-peach-logo-64.png 64w",
  "/brand/taostudio-peach-logo-128.png 128w",
  "/brand/taostudio-peach-logo-256.png 256w",
  "/brand/taostudio-peach-logo-512.png 512w",
].join(", ");

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
  return (
    <img
      className={`object-contain ${className}`.trim()}
      src={PEACH_LOGO_SRC}
      srcSet={PEACH_LOGO_SRC_SET}
      sizes="(max-width: 640px) 40px, 48px"
      width={256}
      height={256}
      alt={decorative ? "" : title}
      aria-hidden={decorative ? true : undefined}
      decoding="async"
      draggable={false}
    />
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
