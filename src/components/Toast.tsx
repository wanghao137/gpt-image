import { useToastQueue, toast, type ToastItem } from "../hooks/useToast";

/**
 * Global toast viewport.
 *
 * Layout strategy:
 *   - Mobile: bottom-centered. Sits above the StickyMobileActions bar
 *     (z-50 vs sticky's z-30). Uses safe-area-inset-bottom so it never
 *     gets covered by the home indicator.
 *   - Desktop: bottom-right, stacked. Gives users glanceable feedback
 *     without yanking attention from the case grid.
 *
 * Animation: enter/exit via plain CSS keyframe `toastIn` / `toastOut`. No
 * dependencies. Reduce-motion preference flattens to instant fade.
 *
 * Single instance: mount once at the root layout. The hook reads from a
 * module-level pub/sub so anywhere in the app can call `toast.success(...)`
 * without prop-drilling or context.
 */
export function ToastViewport() {
  const items = useToastQueue();
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      style={{
        // Lift above the mobile sticky action bar (h ≈ 60px) and the
        // iPhone home indicator. On desktop sm:bottom-6 already clears
        // the BackToTop FAB.
        paddingBottom: "max(5.25rem, calc(env(safe-area-inset-bottom) + 5.25rem))",
      }}
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .toast-card { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const isSuccess = item.variant === "success";
  const isError = item.variant === "error";

  // Tone the chip on the left: green check / red cross / amber dot.
  const accent = isSuccess
    ? "bg-emerald-400 text-emerald-950"
    : isError
      ? "bg-rose-400 text-rose-950"
      : "bg-ember-400 text-ink-950";

  return (
    <div
      role="status"
      className="toast-card pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900/90 p-3 shadow-[0_18px_48px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:w-80"
      style={{
        animation: "toastIn 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
      }}
    >
      <span
        className={
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full " + accent
        }
        aria-hidden="true"
      >
        {isSuccess ? <CheckIcon /> : isError ? <CrossIcon /> : <DotIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold leading-snug text-ink-50">
          {item.title}
        </p>
        {item.description && (
          <p className="mt-0.5 text-[12px] leading-snug text-ink-300">
            {item.description}
          </p>
        )}
        {item.action && (
          <ActionLink action={item.action} onAfter={() => toast.dismiss(item.id)} />
        )}
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(item.id)}
        aria-label="关闭通知"
        className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-500 transition hover:bg-white/[0.06] hover:text-ink-100"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function ActionLink({
  action,
  onAfter,
}: {
  action: NonNullable<ToastItem["action"]>;
  onAfter: () => void;
}) {
  const className =
    "mt-2 inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[12px] font-semibold text-ember-200 transition hover:bg-white/[0.1]";
  if (action.href) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
        onClick={onAfter}
      >
        {action.label}
        <ArrowIcon />
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        action.onClick?.();
        onAfter();
      }}
      className={className}
    >
      {action.label}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="m3.5 8 3 3 6-7" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
function DotIcon() {
  return <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />;
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
function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3 w-3"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
