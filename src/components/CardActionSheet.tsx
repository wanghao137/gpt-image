import { useEffect } from "react";

export interface CardAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  /** Style variant — `accent` paints the row in ember (primary action). */
  variant?: "default" | "accent" | "danger";
  /** Optional secondary line (12px, ink-400). */
  hint?: string;
}

interface CardActionSheetProps {
  open: boolean;
  /** Title shown at the top — typically the case title. */
  title: string;
  /** Optional preview image rendered as a small thumbnail. */
  image?: string;
  /** Optional caption shown under the title. */
  caption?: string;
  actions: CardAction[];
  onClose: () => void;
}

/**
 * Bottom-sheet action menu invoked from a long-press / right-click on a
 * card. Same component on every viewport (mobile bottom sheet vs centred
 * desktop modal — both look identical other than max-width).
 *
 * Implementation notes:
 *   - Backdrop click closes. Escape closes. Body scroll locked while open.
 *   - Each action row is a real <button> with full-row hit area.
 *   - Auto-dismiss after picking an action — every action's onSelect closes.
 *   - We don't render a portal; React-DOM's createPortal would force an
 *     extra dependency for one element. Instead the absolute-positioned
 *     wrapper takes the whole viewport, which is sufficient for z-stacking
 *     above the StickyMobileActions bar (z-30) and below the toast (z-50).
 */
export function CardActionSheet({
  open,
  title,
  image,
  caption,
  actions,
  onClose,
}: CardActionSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="卡片操作"
      className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-950/72 backdrop-blur-md"
        style={{ animation: "fadeIn 160ms ease-out both" }}
      />

      {/* Sheet */}
      <div
        className="relative z-10 w-full overflow-hidden border-t border-white/10 bg-ink-900/95 backdrop-blur-xl sm:m-6 sm:w-auto sm:min-w-[320px] sm:max-w-sm sm:rounded-2xl sm:border"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          animation: "sheetUp 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
          borderTopLeftRadius: "1.5rem",
          borderTopRightRadius: "1.5rem",
        }}
      >
        {/* Drag handle (mobile only) */}
        <div className="mx-auto mt-3 mb-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" />

        {/* Header — case title + optional thumb */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 pb-3 pt-1 sm:pt-4">
          {image && (
            <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-ink-850">
              <img
                src={image}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-ink-50">
              {title}
            </p>
            {caption && (
              <p className="mt-0.5 truncate text-[12px] text-ink-400">{caption}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-500 transition hover:bg-white/[0.06] hover:text-ink-100"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Action rows */}
        <ul className="flex flex-col py-1.5">
          {actions.map((a) => (
            <li key={a.key}>
              <button
                type="button"
                onClick={() => {
                  a.onSelect();
                  onClose();
                }}
                className={
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-white/[0.04] " +
                  (a.variant === "accent"
                    ? "text-ember-200 hover:bg-ember-500/10"
                    : a.variant === "danger"
                      ? "text-rose-300 hover:bg-rose-500/8"
                      : "text-ink-100 hover:bg-white/[0.04]")
                }
              >
                <span
                  className={
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                    (a.variant === "accent"
                      ? "bg-ember-500/15 text-ember-200"
                      : a.variant === "danger"
                        ? "bg-rose-500/15 text-rose-200"
                        : "bg-white/[0.04] text-ink-200")
                  }
                  aria-hidden="true"
                >
                  {a.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {a.label}
                  </span>
                  {a.hint && (
                    <span className="mt-0.5 block truncate text-[12px] font-normal text-ink-400">
                      {a.hint}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes sheetUp {
            from { opacity: 0; transform: translateY(28px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            div[role="dialog"] > div {
              animation: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}
