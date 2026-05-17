import { Link } from "react-router-dom";

interface StickyMobileActionsProps {
  /** Click handler for the primary "copy" action. */
  onCopy: () => void;
  /** Current copy state for visual feedback. */
  copyState: "idle" | "copied" | "error";
  /** When true, the WeChat CTA is the secondary CTA on the right. */
  showWeChat?: boolean;
}

/**
 * Mobile-only fixed action bar at the bottom of the case detail page.
 * Two jobs:
 *   1. Make "Copy Prompt" reachable without scrolling on long detail pages.
 *   2. Keep the WeChat conversion CTA visible at all times.
 *
 * Hides on `sm:` breakpoints — desktop already has the inline buttons.
 */
export function StickyMobileActions({
  onCopy,
  copyState,
  showWeChat = true,
}: StickyMobileActionsProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-ink-950/85 backdrop-blur-xl sm:hidden"
      style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex w-full max-w-7xl gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={onCopy}
          className={
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[13.5px] font-semibold transition " +
            (copyState === "copied"
              ? "bg-emerald-400 text-ink-950"
              : copyState === "error"
                ? "bg-rose-400 text-ink-950"
                : "bg-ember-500 text-ink-950")
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
        {showWeChat && (
          <Link
            to="/services#wechat"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-[13.5px] font-medium text-ink-100"
          >
            <Chat /> 微信定制
          </Link>
        )}
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
function Chat() {
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
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5Z" />
    </svg>
  );
}
