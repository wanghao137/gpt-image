import { useCallback, useEffect, useState } from "react";
import { REPO_TARGET } from "../config";
import {
  GitHubError,
  latestCommitOnPath,
  listWorkflowRuns,
} from "../github";

/**
 * Publish-pipeline indicator for the admin sidebar.
 *
 * "保存到 GitHub 成功" is only the first hop: the content becomes visible
 * when the Content Regenerate workflow rewrites public/data and commits it
 * (2026-08-24..26: four Hermes commits sat invisible on main because the
 * regen gate failed silently). This panel closes that feedback loop with two
 * signals from the GitHub API:
 *   - CI: the Content Regenerate run for the latest data/manual commit
 *   - 上线: whether the latest public/data commit is at least as new
 */
export function PublishStatus({ token }: { token: string }) {
  const [status, setStatus] = useState<PublishState>({ kind: "checking" });

  const load = useCallback(async () => {
    try {
      // The commits endpoints work with a plain Contents token; the Actions
      // API needs a separate Actions:read permission. Degrade to the commit-
      // timestamp signal instead of failing the whole panel when the token
      // can't list runs.
      const [manual, published] = await Promise.all([
        latestCommitOnPath(REPO_TARGET, "data/manual", token),
        latestCommitOnPath(REPO_TARGET, "public/data", token),
      ]);
      const runs = await listWorkflowRuns(REPO_TARGET, token, 20).catch(() => null);
      if (!manual) {
        setStatus({ kind: "none" });
        return;
      }
      const run = runs?.find(
        (r) => r.headSha === manual.sha && /content regenerate/i.test(r.name),
      );
      const online = Boolean(
        published && published.date && Date.parse(published.date) >= Date.parse(manual.date),
      );

      if (run && run.status !== "completed") {
        setStatus({ kind: "regenerating", runUrl: run.htmlUrl });
      } else if (run && run.conclusion && run.conclusion !== "success") {
        setStatus({ kind: "failed", runUrl: run.htmlUrl, detail: run.conclusion });
      } else if (run && run.conclusion === "success") {
        setStatus({ kind: "ok", commitUrl: manual.url });
      } else if (online) {
        setStatus({ kind: "ok", commitUrl: manual.url });
      } else {
        setStatus({ kind: "pending", commitUrl: manual.url });
      }
    } catch (error) {
      // GitHub rate limits etc. — degrade to an inert indicator, never block.
      if (error instanceof GitHubError && error.status === 403) {
        setStatus({ kind: "unknown", detail: "GitHub API 受限" });
      } else {
        setStatus({ kind: "unknown" });
      }
    }
  }, [token]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-950/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
          内容发布
        </p>
        <StatusChip status={status} />
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{describe(status)}</p>
      {"runUrl" in status && status.runUrl && (
        <a
          href={status.runUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-[11.5px] font-medium text-ember-300 transition hover:text-ember-200"
        >
          {status.kind === "failed" ? "查看失败运行 ↗" : "查看运行 ↗"}
        </a>
      )}
    </div>
  );
}

type PublishState =
  | { kind: "checking" }
  | { kind: "none" }
  | { kind: "ok"; commitUrl?: string }
  | { kind: "regenerating"; runUrl?: string }
  | { kind: "pending"; commitUrl?: string }
  | { kind: "failed"; runUrl?: string; detail?: string }
  | { kind: "unknown"; detail?: string };

function StatusChip({ status }: { status: PublishState }) {
  const map: Record<PublishState["kind"], { label: string; className: string }> = {
    checking: { label: "…", className: "bg-white/[0.06] text-ink-300" },
    none: { label: "无内容", className: "bg-white/[0.06] text-ink-300" },
    ok: { label: "已上线", className: "bg-emerald-500/15 text-emerald-200" },
    regenerating: { label: "再生中", className: "bg-ember-500/15 text-ember-200" },
    pending: { label: "待再生", className: "bg-amber-500/15 text-amber-200" },
    failed: { label: "再生失败", className: "bg-rose-500/15 text-rose-200" },
    unknown: { label: "未知", className: "bg-white/[0.06] text-ink-300" },
  };
  const chip = map[status.kind];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${chip.className}`}
    >
      {chip.label}
    </span>
  );
}

function describe(status: PublishState): string {
  switch (status.kind) {
    case "checking":
      return "正在检查发布管线…";
    case "none":
      return "仓库还没有内容提交。";
    case "ok":
      return "最新内容已通过再生并上线（或无需再生）。";
    case "regenerating":
      return "Content Regenerate 正在重建 public/data，约 1–2 分钟后上线。";
    case "pending":
      return "内容已提交，但再生尚未触发——若长时间停留，请手动触发 content.yml。";
    case "failed":
      return "再生闸门失败：内容已提交但尚未上线（通常是词表或数据一致性拦截）。";
    case "unknown":
      return status.detail ?? "暂时无法获取发布状态。";
  }
}
