import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

function routeErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText || "页面加载失败"}`;
  }
  if (error instanceof Error) return error.message;
  return "页面加载失败";
}

export function AppErrorBoundary() {
  const error = useRouteError();
  const message = routeErrorMessage(error);

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-ink-100">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
        <div className="border-l border-ember-500/60 pl-5">
          <p className="text-sm uppercase tracking-[0.24em] text-ember-300">TaoStudio</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-ink-50 sm:text-4xl">
            页面加载中断
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink-300">{message}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-ember-500 px-5 py-3 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-ember-400"
            >
              重新加载
            </button>
            <Link
              to="/"
              className="rounded-full border border-ink-600 px-5 py-3 text-sm font-semibold text-ink-100 transition hover:border-ember-400 hover:text-ember-200"
            >
              回到首页
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
