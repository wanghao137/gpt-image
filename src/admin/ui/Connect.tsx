import { useState } from "react";
import { REPO_TARGET } from "../config";
import { checkToken } from "../github";
import { saveToken } from "../auth";
import { BrandMark, Button } from "./Primitives";

interface ConnectProps {
  onConnected: (token: string, login: string) => void;
}

/**
 * GitHub connection screen. We never persist the token to localStorage —
 * sessionStorage only. Re-opening the tab fresh requires re-pasting it.
 *
 * Layout: full-bleed two-column on lg+, where the left rail tells the
 * "what is this" story (matches public-site editorial vibe) and the right
 * holds the actual form. On smaller screens it stacks.
 */
export function Connect({ onConnected }: ConnectProps) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const { login } = await checkToken(REPO_TARGET, token.trim());
      saveToken(token.trim());
      onConnected(token.trim(), login);
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接失败");
    } finally {
      setBusy(false);
    }
  };

  const repoLabel = `${REPO_TARGET.owner}/${REPO_TARGET.repo}`;
  const tokenUrl = "https://github.com/settings/personal-access-tokens/new";

  return (
    <div className="relative min-h-screen px-5 py-12 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-16 h-[26rem] w-[26rem] rounded-full bg-ember-500/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-16 h-[24rem] w-[24rem] rounded-full bg-ember-700/10 blur-[100px]"
      />

      <div className="container-narrow relative grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)] lg:gap-16">
        {/* Left: editorial intro */}
        <div className="pt-2">
          <div className="mb-6 flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="eyebrow">Step 02 · Connect</p>
              <p className="mt-0.5 text-[12.5px] text-ink-400">
                Admin Studio
              </p>
            </div>
          </div>

          <h1 className="serif-display text-[40px] leading-[1.04] text-ink-50 sm:text-[52px]">
            连接到 GitHub
            <br />
            开始<em className="not-italic">
              <span className="bg-gradient-to-br from-ember-200 via-ember-400 to-ember-600 bg-clip-text text-transparent">
                编辑内容
              </span>
              <span className="text-ember-400">.</span>
            </em>
          </h1>

          <p className="mt-5 max-w-xl text-[14.5px] leading-relaxed text-ink-300">
            管理后台直接通过 GitHub Contents API 把改动写回仓库。CI 会自动打包重新部署，
            通常 1–2 分钟内线上即可看到变更。Token 仅保存在当前标签页的 session 中，
            关闭即清除。
          </p>

          <ul className="mt-8 space-y-3 text-[13px] leading-relaxed text-ink-300">
            <Step
              n={1}
              title="生成 Fine-grained Token"
              body={
                <>
                  在 GitHub 设置里创建 <strong className="text-ink-100">Fine-grained personal access token</strong>，
                  限定 Repository access 仅 <code className="font-mono text-[12px] text-ember-200">{repoLabel}</code>。
                </>
              }
            />
            <Step
              n={2}
              title="授予 Contents 权限"
              body={
                <>
                  Permissions → <strong className="text-ink-100">Contents: Read and write</strong>。
                  其他权限不需要。
                </>
              }
            />
            <Step
              n={3}
              title="贴到右侧"
              body={
                <>
                  过期时间建议 30–90 天，过期后回到这里粘贴新 token 即可继续工作。
                </>
              }
            />
          </ul>
        </div>

        {/* Right: form card */}
        <form onSubmit={submit} className="surface p-6 shadow-soft sm:p-7">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-ink-950/50 p-4 sm:grid-cols-4">
            <Stat label="Owner" value={REPO_TARGET.owner} />
            <Stat label="Repo" value={REPO_TARGET.repo} />
            <Stat label="Branch" value={REPO_TARGET.branch} />
            <Stat label="API" value="api.github.com" />
          </div>

          <label className="mt-5 block">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                Personal Access Token <span className="ml-1 text-ember-400">*</span>
              </span>
              <a
                href={tokenUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-ember-300 transition hover:text-ember-200"
              >
                生成新 token →
              </a>
            </div>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_..."
              autoComplete="off"
              spellCheck={false}
              className="input-base font-mono text-[12.5px]"
            />
          </label>

          {error && (
            <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] font-medium text-rose-200">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[11.5px] leading-relaxed text-ink-500">
              Token 仅保存在 <code className="font-mono text-ink-300">sessionStorage</code>，
              关闭标签页即清除。
            </p>
            <Button type="submit" variant="primary" loading={busy} disabled={!token.trim()}>
              连接并解锁
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ember-500/40 bg-ember-500/10 text-[11px] font-semibold text-ember-200">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink-100">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-400">{body}</p>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-[12.5px] text-ink-100">{value}</p>
    </div>
  );
}
