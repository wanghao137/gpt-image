/**
 * Small UI/text utilities for the admin panel.
 */

import type { ManualCase } from "./types";

/** Suggest the next id by taking max(ids in the 100000+ range) + 1. */
export function suggestNextCaseId(items: ManualCase[]): string {
  let max = 100000;
  for (const c of items) {
    const n = Number(c.id);
    if (!Number.isFinite(n)) continue;
    if (n > max) max = n;
  }
  return String(max + 1);
}

/** Build a sensible upload filename: 2026-05-17-slug.ext */
export function buildUploadFilename(originalName: string, slug?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const ext = (originalName.match(/\.[a-z0-9]+$/i)?.[0] || ".jpg").toLowerCase();
  const base =
    (slug || originalName.replace(/\.[a-z0-9]+$/i, ""))
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "image";
  return `${today}-${base}${ext}`;
}

/** Format byte count for the upload preview (KB/MB). */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Returns true when the ID would collide with another item in the list (excluding self). */
export function collides<T extends { id: string }>(
  items: T[],
  id: string,
  selfIndex: number,
): boolean {
  return items.some((item, i) => i !== selfIndex && item.id === id.trim());
}

export function makeEmptyCase(id: string): ManualCase {
  return {
    id,
    title: "",
    category: "其他用例",
    styles: [],
    scenes: [],
    imageUrl: "",
    prompt: "",
  };
}

/** A short summary string used in commit messages. */
export function summarize(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
}
