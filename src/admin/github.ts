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

/** Verify the token is valid and the repo is reachable. */
export async function checkToken(target: RepoTarget, token: string): Promise<{
  login: string;
}> {
  const u = await fetch(`${API}/user`, { headers: authHeaders(token) });
  if (!u.ok) throw new GitHubError("Token invalid or expired", u.status);
  const user = (await u.json()) as { login: string };

  const r = await fetch(`${API}/repos/${target.owner}/${target.repo}`, {
    headers: authHeaders(token),
  });
  if (!r.ok) {
    if (r.status === 404)
      throw new GitHubError("Repo not found, or token lacks access", 404);
    throw new GitHubError(`Repo check failed: ${r.statusText}`, r.status);
  }
  return user;
}

/** Read a UTF-8 text file. Returns null if the file does not exist (404). */
export async function readTextFile(
  target: RepoTarget,
  path: string,
  token: string,
): Promise<FileBlob | null> {
  const url = `${API}/repos/${target.owner}/${target.repo}/contents/${encodeURI(
    path,
  )}?ref=${encodeURIComponent(target.branch)}`;
  const r = await fetch(url, { headers: authHeaders(token) });
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
  const r = await fetch(
    `${API}/repos/${target.owner}/${target.repo}/contents/${encodeURI(path)}`,
    {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
): Promise<string> {
  const content = await blobToBase64(blob);
  const r = await fetch(
    `${API}/repos/${target.owner}/${target.repo}/contents/${encodeURI(path)}`,
    {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ message, content, branch: target.branch }),
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
