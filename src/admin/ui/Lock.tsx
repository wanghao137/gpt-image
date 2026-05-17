import { useEffect, useRef, useState } from "react";
import { adminPasswordRequired, tryUnlock } from "../auth";
import { BrandMark } from "./Primitives";

interface LockProps {
  onUnlock: () => void;
}

/**
 * Login gate. Shown when the build was configured with a password hash and
 * the current session has not unlocked yet. The hash compare is local — no
 * network round-trip — and the password never leaves the device.
 *
 * Layout note: this is the first impression of the admin. We treat it like
 * the public-site hero — large serif display title, ember accents, soft
 * radial backdrop — so the editor doesn't feel like a separate dashboard.
 */
export function Lock({ onUnlock }: LockProps) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
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
        setShake(true);
        window.setTimeout(() => setShake(false), 420);
        inputRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      {/* Soft ember orbs — a calmer echo of the public hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-16 h-[28rem] w-[28rem] rounded-full bg-ember-500/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-16 h-[24rem] w-[24rem] rounded-full bg-ember-700/10 blur-[100px]"
      />

      <form
        onSubmit={submit}
        className={
          "surface relative w-full max-w-sm p-7 shadow-soft transition-transform " +
          (shake ? "animate-[shake_0.42s_ease-in-out]" : "")
        }
      >
        <div className="mb-7 flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <div>
            <p className="eyebrow">Restricted access</p>
            <h1 className="serif-display mt-0.5 text-[22px] leading-tight text-ink-50">
              Admin Studio
            </h1>
          </div>
        </div>

        {!adminPasswordRequired && (
          <p className="mb-5 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-[12px] leading-relaxed text-amber-100">
            未设置 <code className="font-mono text-[11.5px]">VITE_ADMIN_PASSWORD_HASH</code>，
            将以无密码模式进入。请在生产构建前配置环境变量。
          </p>
        )}

        <label className="block">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            访问密码
          </span>
          <div className="relative mt-1.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!adminPasswordRequired}
              className="w-full rounded-lg border border-white/[0.08] bg-ink-950/50 py-2.5 pl-9 pr-3 text-[14px] text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/15 disabled:opacity-40"
              placeholder={adminPasswordRequired ? "输入密码以解锁" : "未启用密码保护"}
              autoComplete="current-password"
              aria-invalid={Boolean(error)}
            />
          </div>
        </label>

        {error && (
          <p className="mt-3 text-[12px] font-medium text-rose-300">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy || (adminPasswordRequired && !password)}
          className="btn-primary mt-6 w-full justify-center"
        >
          {busy ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
                clipRule="evenodd"
              />
            </svg>
          )}
          进入工作台
        </button>

        <p className="mt-6 text-[11.5px] leading-relaxed text-ink-500">
          这是一个只对你开放的管理入口。密码哈希在构建时注入，验证完全发生在浏览器本地，密码从不离开你的设备。
        </p>
      </form>

      {/* Local keyframes — tailwind doesn't ship a `shake` utility. */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
        }
      `}</style>
    </div>
  );
}
