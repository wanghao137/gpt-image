/**
 * Minimal GitHub Contents API client.
 *
 * Used by the admin panel to read/write `data/manual/cases.json` directly from
 * the browser. After a successful write, GitHub Actions picks up the commit and
 * redeploys the site (~1–2 min).
 *
 * PAT scopes required (fine-grained recommended):
 *   - Repository access: this repo only
 *   - Permissions → Contents: Read & write
 */

import { base64ToUtf8, blobToBase64, utf8ToBase64 } from "./crypto";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";

export interface RepoTarget {
  owner: string;
  repo: string;
  branch: string;
}

const API = "https://api.github.com";

export interface FileBlob {
  /** Decoded UTF-8 content (only set when the file is a text file). */
  text: string;
  /** SHA needed when updating the file. */
  sha: string;
}

export class GitHubError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "GitHubError";
  }
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Encode a repo file path for the Contents API. Per-segment
 * `encodeURIComponent` (preserving `/`) so chars like `?`, `#`, `&`, space are
 * escaped — `encodeURI` left those intact, a latent path-injection gap.
 */
function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

// Binary/large uploads can be slow on weak networks; allow more headroom than
// the default 10s used for small JSON reads.
const READ_TIMEOUT_MS = 12000;
const WRITE_TIMEOUT_MS = 30000;

/** Verify the token is valid, the repo is reachable, AND it can write. */
export async function checkToken(target: RepoTarget, token: string): Promise<{
  login: string;
}> {
  const u = await fetchWithTimeout(`${API}/user`, {
    headers: authHeaders(token),
    timeoutMs: READ_TIMEOUT_MS,
  });
  if (!u.ok) throw new GitHubError("Token invalid or expired", u.status);
  const user = (await u.json()) as { login: string };

  const r = await fetchWithTimeout(`${API}/repos/${target.owner}/${target.repo}`, {
    headers: authHeaders(token),
    timeoutMs: READ_TIMEOUT_MS,
  });
  if (!r.ok) {
    if (r.status === 404)
      throw new GitHubError("Repo not found, or token lacks access", 404);
    throw new GitHubError(`Repo check failed: ${r.statusText}`, r.status);
  }
  // A read-only token passes the repo check above but would fail on the first
  // save. Catch it here so "连接成功" means "可以实际写入".
  const repo = (await r.json()) as { permissions?: { push?: boolean } };
  if (!repo.permissions?.push) {
    throw new GitHubError(
      "Token 对该仓库没有写权限。请为 token 授予 Contents: Read and write 后重试。",
      403,
    );
  }
  return user;
}

/** Read a UTF-8 text file. Returns null if the file does not exist (404). */
export async function readTextFile(
  target: RepoTarget,
  path: string,
  token: string,
): Promise<FileBlob | null> {
  const url = `${API}/repos/${target.owner}/${target.repo}/contents/${encodePath(
    path,
  )}?ref=${encodeURIComponent(target.branch)}`;
  const r = await fetchWithTimeout(url, {
    headers: authHeaders(token),
    timeoutMs: READ_TIMEOUT_MS,
  });
  if (r.status === 404) return null;
  if (!r.ok)
    throw new GitHubError(`Read ${path} failed: ${r.statusText}`, r.status);
  const json = (await r.json()) as { content: string; sha: string; encoding: string };
  if (json.encoding !== "base64")
    throw new GitHubError(`Unexpected encoding: ${json.encoding}`);
  return { text: base64ToUtf8(json.content), sha: json.sha };
}

interface PutOptions {
  /** Existing file SHA, omit when creating a new file. */
  sha?: string;
  /** Commit message; defaults to a content-edit message. */
  message: string;
}

/** Create or update a UTF-8 text file. Returns the new SHA. */
export async function writeTextFile(
  target: RepoTarget,
  path: string,
  text: string,
  token: string,
  opts: PutOptions,
): Promise<string> {
  const body: Record<string, unknown> = {
    message: opts.message,
    content: utf8ToBase64(text),
    branch: target.branch,
  };
  if (opts.sha) body.sha = opts.sha;
  const r = await fetchWithTimeout(
    `${API}/repos/${target.owner}/${target.repo}/contents/${encodePath(path)}`,
    {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: WRITE_TIMEOUT_MS,
    },
  );
  if (!r.ok) {
    const detail = await r.text();
    throw new GitHubError(
      `Write ${path} failed: ${r.statusText} – ${detail.slice(0, 200)}`,
      r.status,
    );
  }
  const json = (await r.json()) as { content: { sha: string } };
  return json.content.sha;
}

/** Upload a binary file (e.g. an image). Returns the new SHA. */
export async function writeBinaryFile(
  target: RepoTarget,
  path: string,
  blob: Blob,
  token: string,
  message: string,
  /** Existing file SHA — required to overwrite a file that already exists. */
  sha?: string,
): Promise<string> {
  const content = await blobToBase64(blob);
  const body: Record<string, unknown> = { message, content, branch: target.branch };
  if (sha) body.sha = sha;
  const r = await fetchWithTimeout(
    `${API}/repos/${target.owner}/${target.repo}/contents/${encodePath(path)}`,
    {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: WRITE_TIMEOUT_MS,
    },
  );
  if (!r.ok) {
    const detail = await r.text();
    throw new GitHubError(
      `Upload ${path} failed: ${r.statusText} – ${detail.slice(0, 200)}`,
      r.status,
    );
  }
  const json = (await r.json()) as { content: { sha: string } };
  return json.content.sha;
}

/** Get the current blob SHA of a repo file (null when it does not exist). */
export async function getFileSha(
  target: RepoTarget,
  path: string,
  token: string,
): Promise<string | null> {
  const r = await fetchWithTimeout(
    `${API}/repos/${target.owner}/${target.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(
      target.branch,
    )}`,
    { headers: authHeaders(token), timeoutMs: READ_TIMEOUT_MS },
  );
  if (r.status === 404) return null;
  if (!r.ok)
    throw new GitHubError(`Read ${path} failed: ${r.statusText}`, r.status);
  const json = (await r.json()) as { sha: string };
  return json.sha;
}

export interface LatestCommit {
  sha: string;
  /** ISO committer date. */
  date: string;
  url: string;
}

/** Latest commit on the target branch that touched the given path (null when none). */
export async function latestCommitOnPath(
  target: RepoTarget,
  path: string,
  token: string,
): Promise<LatestCommit | null> {
  const r = await fetchWithTimeout(
    `${API}/repos/${target.owner}/${target.repo}/commits?path=${encodeURIComponent(
      path,
    )}&sha=${encodeURIComponent(target.branch)}&per_page=1`,
    { headers: authHeaders(token), timeoutMs: READ_TIMEOUT_MS },
  );
  if (!r.ok) throw new GitHubError(`List commits for ${path} failed: ${r.statusText}`, r.status);
  const list = (await r.json()) as Array<{
    sha: string;
    html_url: string;
    commit: { committer?: { date?: string } };
  }>;
  const head = list[0];
  if (!head) return null;
  return {
    sha: head.sha,
    date: head.commit?.committer?.date ?? "",
    url: head.html_url,
  };
}

export interface WorkflowRunInfo {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  headSha: string;
  htmlUrl: string;
}

/** Recent workflow runs on the target branch (newest first). */
export async function listWorkflowRuns(
  target: RepoTarget,
  token: string,
  perPage = 20,
): Promise<WorkflowRunInfo[]> {
  const r = await fetchWithTimeout(
    `${API}/repos/${target.owner}/${target.repo}/actions/runs?branch=${encodeURIComponent(
      target.branch,
    )}&per_page=${perPage}`,
    { headers: authHeaders(token), timeoutMs: READ_TIMEOUT_MS },
  );
  if (!r.ok) throw new GitHubError(`List workflow runs failed: ${r.statusText}`, r.status);
  const json = (await r.json()) as {
    workflow_runs?: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      head_sha: string;
      html_url: string;
    }>;
  };
  return (json.workflow_runs ?? []).map((run) => ({
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.head_sha,
    htmlUrl: run.html_url,
  }));
}
