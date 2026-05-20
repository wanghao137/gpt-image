interface StickyMobileActionsProps {
  /** Click handler for the primary "copy" action. */
  onCopy: () => void;
  /** Current copy state for visual feedback. */
  copyState: "idle" | "copied" | "error";
  /**
   * Optional context shown above the buttons — typically the prompt's
   * character count, used to remind the user what they're about to copy.
   * Hidden when undefined to keep the bar compact.
   */
  caption?: string;
  /** Disable the primary action while the prompt is still loading. */
  disabled?: boolean;
}

/**
 * Mobile-only fixed action bar at the bottom of the case detail page.
 * Single job: make "Copy Prompt" reachable without scrolling on long
 * detail pages, and surface copy state at all times.
 *
 * Hides on `sm:` breakpoints — desktop already has the inline button
 * inside the prompt toolbar.
 */
export function StickyMobileActions({
  onCopy,
  copyState,
  caption,
  disabled = false,
}: StickyMobileActionsProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-ink-950/85 backdrop-blur-xl sm:hidden"
      style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
    >
      {caption && (
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
          <span>{caption}</span>
          {copyState === "copied" && (
            <span className="text-emerald-300">✓ 已复制</span>
          )}
        </div>
      )}
      <div className="mx-auto flex w-full max-w-7xl gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={onCopy}
          disabled={disabled}
          className={
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[13.5px] font-semibold transition disabled:opacity-50 " +
            (copyState === "copied"
              ? "bg-emerald-400 text-ink-950"
              : copyState === "error"
                ? "bg-rose-400 text-ink-950"
                : "bg-ember-500 text-ink-950 active:bg-ember-400")
          }
        >
          {copyState === "copied" ? (
            <>
              <Check /> 已复制
            </>
          ) : copyState === "error" ? (
            "复制失败"
          ) : (
            <>
              <Copy /> 复制 Prompt
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}
function Copy() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
