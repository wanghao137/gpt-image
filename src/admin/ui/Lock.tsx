import { useEffect, useRef, useState } from "react";
import { adminPasswordRequired, tryUnlock } from "../auth";

interface LockProps {
  onUnlock: () => void;
}

/**
 * Login gate. Shown when the build was configured with a password hash and
 * the current session has not unlocked yet. The hash compare is local — no
 * network round-trip — and the password never leaves the device.
 */
export function Lock({ onUnlock }: LockProps) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const ok = await tryUnlock(password);
      if (ok) onUnlock();
      else {
        setError("密码错误");
        setPassword("");
        inputRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-20 h-[28rem] w-[28rem] rounded-full bg-ember-500/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-20 h-[24rem] w-[24rem] rounded-full bg-ember-700/10 blur-[100px]"
      />

      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-3xl border border-white/[0.08] bg-white/[0.02] p-7 backdrop-blur-sm shadow-soft"
      >
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ember-500/15 text-ember-300">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-ink-400">
              Restricted access
            </p>
            <h1 className="serif-display text-xl text-ink-50">Admin · Gallery</h1>
          </div>
        </div>

        {!adminPasswordRequired ? (
          <p className="mb-4 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-[12.5px] leading-relaxed text-amber-100">
            未设置 <code className="font-mono text-[12px]">VITE_ADMIN_PASSWORD_HASH</code>，
            将以无密码模式进入。请在生产构建前配置环境变量。
          </p>
        ) : null}

        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
            访问密码
          </span>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!adminPasswordRequired}
            className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-ink-950/40 px-3 py-2.5 text-[14px] text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-ember-500/50 focus:ring-2 focus:ring-ember-500/15 disabled:opacity-40"
            placeholder={adminPasswordRequired ? "输入密码以解锁" : "未启用密码保护"}
            autoComplete="current-password"
          />
        </label>

        {error && (
          <p className="mt-3 text-[12px] font-medium text-rose-300">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy || (adminPasswordRequired && !password)}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ember-500 px-4 py-2.5 text-[13.5px] font-medium text-ink-950 transition hover:bg-ember-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
                clipRule="evenodd"
              />
            </svg>
          )}
          进入工作台
        </button>

        <p className="mt-5 text-[11px] leading-relaxed text-ink-500">
          这是一个只对你开放的管理入口。密码哈希在构建时注入，验证完全发生在浏览器本地。
        </p>
      </form>
    </div>
  );
}
