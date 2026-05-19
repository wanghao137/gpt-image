/**
 * Tiny global toast bus.
 *
 * Why a module-level event bus instead of React Context:
 *   - The site is SSG (vite-react-ssg). Context Providers wrapping the
 *     route tree are fine, but they'd force every page to re-import a
 *     hook just to fire a toast — and toast firing happens deep inside
 *     non-component code paths (clipboard handlers, fetch error catches).
 *   - A module-level pub/sub is 25 lines, zero allocation per toast
 *     dispatch, and naturally a no-op during SSR (no listeners attached).
 *
 * Usage:
 *   import { toast } from "../hooks/useToast";
 *   toast.success("已复制");
 *   toast.success("Prompt 已复制", {
 *     description: "去 ChatGPT 粘贴",
 *     action: { label: "打开 ChatGPT", href: "https://chat.openai.com" },
 *   });
 *
 *   // Listening:
 *   const items = useToastQueue(); // mounted once at the root layout
 */
import { useEffect, useState } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  href?: string;
  /** When provided overrides href; runs in the toast element's click handler. */
  onClick?: () => void;
}

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss in ms. Defaults to 2400 for success, 4000 for error. */
  durationMs?: number;
  action?: ToastAction;
}

export interface ToastItem extends Required<Omit<ToastInput, "description" | "action">> {
  id: number;
  description?: string;
  action?: ToastAction;
}

type Listener = (items: ToastItem[]) => void;

let counter = 0;
let queue: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(queue);
}

function dismissAfter(item: ToastItem) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    queue = queue.filter((i) => i.id !== item.id);
    emit();
  }, item.durationMs);
}

function push(input: ToastInput): number {
  const variant: ToastVariant = input.variant ?? "info";
  const item: ToastItem = {
    id: ++counter,
    title: input.title,
    description: input.description,
    variant,
    durationMs:
      input.durationMs ??
      (variant === "error" ? 4000 : variant === "success" ? 2400 : 3200),
    action: input.action,
  };
  queue = [...queue, item];
  emit();
  dismissAfter(item);
  return item.id;
}

export const toast = {
  success(title: string, opts: Omit<ToastInput, "title" | "variant"> = {}) {
    return push({ ...opts, title, variant: "success" });
  },
  error(title: string, opts: Omit<ToastInput, "title" | "variant"> = {}) {
    return push({ ...opts, title, variant: "error" });
  },
  info(title: string, opts: Omit<ToastInput, "title" | "variant"> = {}) {
    return push({ ...opts, title, variant: "info" });
  },
  dismiss(id: number) {
    queue = queue.filter((i) => i.id !== id);
    emit();
  },
};

/**
 * Subscribe a single React tree to the toast queue. Mount the returned items
 * inside a portal-like element at the root layout — there should only be ONE
 * consumer of this hook on the page at a time.
 */
export function useToastQueue(): ToastItem[] {
  const [items, setItems] = useState<ToastItem[]>(queue);
  useEffect(() => {
    const handler: Listener = (next) => setItems(next);
    listeners.add(handler);
    // Sync once on mount in case toasts were queued before hydration.
    setItems(queue);
    return () => {
      listeners.delete(handler);
    };
  }, []);
  return items;
}
