import type { Ratio } from "../types";

const ICON: Record<string, string> = {
  "9:16": "▯",
  "4:5": "▯",
  "3:4": "▯",
  "1:1": "▢",
  "16:9": "▭",
  "2:3": "▯",
};

/** Lightweight badge showing a case's render ratio — replaces the noisy ID badge. */
export function RatioBadge({ ratio }: { ratio: Ratio }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-ink-950/70 px-2 py-1 text-[10.5px] font-semibold tracking-wide text-ink-100 backdrop-blur">
      <span aria-hidden="true" className="text-[10px] text-ember-300">
        {ICON[ratio] ?? "▯"}
      </span>
      {ratio}
    </span>
  );
}
