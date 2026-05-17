import { useState } from "react";
import { REPO_TARGET } from "../config";
import { checkToken } from "../github";
import { saveToken } from "../auth";
import { Button, Field, TextInput } from "./Primitives";

interface ConnectProps {
  onConnected: (token: string, login: string) => void;
}

/**
 * GitHub connection screen. We never persist the token to localStorage —
 * sessionStorage only. Re-opening the tab fresh requires re-pasting it.
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setBusy(false);
    }
  };

  const repoLabel = `${REPO_TARGET.owner}/${REPO_TARGET.repo}`;
  const tokenUrl = `https://github.com/settings/personal-access-tokens/new`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-400">
          Step 02 · Connect
        </p>
        <h1 className="serif-display mt-2 text-3xl text-ink-50">连接 GitHub 仓库</h1>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-400">
          管理后台直接通过 GitHub Contents API 把改动写回仓库。CI 会自动打包重新部署，
          通常 1–2 分钟内线上即可看到变更。Token 仅保存在当前标签页的 session 中，
          关闭即清除。
        </p>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm"
      >
        <div className="mb-5 grid grid-cols-2 gap-4 rounded-xl border border-white/[0.06] bg-ink-950/40 p-4 sm:grid-cols-4">
          <Stat label="Owner" value={REPO_TARGET.owner} />
          <Stat label="Repo" value={REPO_TARGET.repo} />
          <Stat label="Branch" value={REPO_TARGET.branch} />
          <Stat label="API" value="api.github.com" />
        </div>

        <Field
          label="Personal Access Token"
          required
          hint={
            <a
              href={tokenUrl}
              target="_blank"
              rel="noreferrer"
              className="text-ember-300 transition hover:text-ember-200"
            >
              生成新 token →
            </a>
          }
        >
          <TextInput
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_..."
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <ul className="mt-4 space-y-1.5 text-[12px] leading-relaxed text-ink-400">
          <li className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-ember-400" />
            选 <strong className="text-ink-200">Fine-grained personal access token</strong>，
            限定 Repository access 仅 <code className="font-mono text-ink-100">{repoLabel}</code>
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-ember-400" />
            Permissions → <strong className="text-ink-200">Contents: Read and write</strong>
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-ember-400" />
            过期时间建议 30–90 天，过期后回到这里粘贴新 token 即可
          </li>
        </ul>

        {error && (
          <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] font-medium text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="submit" variant="primary" loading={busy} disabled={!token.trim()}>
            连接并解锁
          </Button>
        </div>
      </form>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">{label}</p>
      <p className="mt-1 truncate font-mono text-[12.5px] text-ink-100">{value}</p>
    </div>
  );
}
