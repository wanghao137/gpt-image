/**
 * Admin data store — a tiny custom hook that owns the in-memory copies of the
 * two manual JSON files plus their server SHAs. We keep this deliberately
 * framework-light: no Redux, no context, just useReducer + a couple of
 * GitHub helpers.
 *
 * Edit-safety model (learned the hard way):
 *   - Refreshing from GitHub with unsaved edits would silently discard them,
 *     so refresh() backs the current data up to a localStorage draft and asks
 *     for confirmation first.
 *   - Edits made WHILE a save is in flight used to be marked "已同步" when the
 *     save landed (save:done cleared `dirty` unconditionally). FileState keeps
 *     a `revision` counter so dirty is recomputed as "revision > revision at
 *     save start".
 *   - A 409 from GitHub means someone else (usually Hermes) advanced the file.
 *     We back up the local edits to the draft, then surface a friendly error
 *     pointing at "恢复草稿" instead of a raw GitHub payload.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { PATHS, REPO_TARGET } from "./config";
import { GitHubError, readTextFile, writeTextFile } from "./github";
import type { ManualCase, ManualTemplate, FileState } from "./types";

const DRAFT_KEY = "admin:draft:v1";

interface DraftSnapshot {
  savedAt: string;
  cases: ManualCase[];
  templates: ManualTemplate[];
}

function readDraft(): DraftSnapshot | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftSnapshot;
    if (!Array.isArray(parsed?.cases) || !Array.isArray(parsed?.templates)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function backupDraft(cases: ManualCase[], templates: ManualTemplate[]): void {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), cases, templates }),
    );
  } catch {
    // Quota errors etc. — the draft is a best-effort safety net, never a
    // hard dependency.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** Read the saved draft without consuming it (for sidebar affordances). */
export function peekDraft(): DraftSnapshot | null {
  return readDraft();
}

interface State {
  cases: FileState<ManualCase[]>;
  templates: FileState<ManualTemplate[]>;
  loading: boolean;
  loadError: string;
  saving: boolean;
  /** What made the store clean last: "save" (draft is obsolete) vs "load" (draft is the recovery point). */
  cleanSource: "save" | "load" | null;
  /** Increments on every load:done — lets save:done detect a refresh that landed mid-flight. */
  loadEpoch: number;
}

type Action =
  | { type: "load:start" }
  | {
      type: "load:done";
      cases: FileState<ManualCase[]>;
      templates: FileState<ManualTemplate[]>;
    }
  | { type: "load:fail"; error: string }
  | { type: "cases:set"; data: ManualCase[] }
  | { type: "templates:set"; data: ManualTemplate[] }
  | { type: "save:start" }
  | {
      type: "save:done";
      kind: "cases" | "templates";
      sha: string;
      savedRevision: number;
      savedLoadEpoch: number;
    }
  | { type: "save:fail" };

const empty = <T,>(data: T): FileState<T> => ({ data, sha: null, dirty: false, revision: 0 });

const initial: State = {
  cases: empty<ManualCase[]>([]),
  templates: empty<ManualTemplate[]>([]),
  loading: false,
  loadError: "",
  saving: false,
  cleanSource: null,
  loadEpoch: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load:start":
      return { ...state, loading: true, loadError: "" };
    case "load:done":
      return {
        ...state,
        loading: false,
        cases: action.cases,
        templates: action.templates,
        // A clean produced by loading remote data must NOT clear the draft —
        // that draft holds the edits refresh just replaced (recovery path).
        cleanSource: "load",
        loadEpoch: state.loadEpoch + 1,
      };
    case "load:fail":
      return { ...state, loading: false, loadError: action.error };
    case "cases:set":
      return {
        ...state,
        cases: {
          ...state.cases,
          data: action.data,
          dirty: true,
          revision: state.cases.revision + 1,
        },
      };
    case "templates:set":
      return {
        ...state,
        templates: {
          ...state.templates,
          data: action.data,
          dirty: true,
          revision: state.templates.revision + 1,
        },
      };
    case "save:start":
      return { ...state, saving: true };
    case "save:done": {
      // Keep `dirty` true when edits landed after this save started — those
      // changes are in memory but NOT in the commit that just succeeded.
      const fileDirty =
        action.kind === "cases"
          ? state.cases.revision > action.savedRevision
          : state.templates.revision > action.savedRevision;
      const stillDirty =
        fileDirty ||
        (action.kind === "cases" ? state.templates.dirty : state.cases.dirty);
      // If a refresh landed while this save was in flight, the pre-save draft
      // still holds in-memory edits the refresh replaced — keep it (treat as
      // "load") instead of clearing on the save's clean.
      const loadInterleaved = state.loadEpoch !== action.savedLoadEpoch;
      const base = {
        ...state,
        saving: false,
        cleanSource: stillDirty ? state.cleanSource : loadInterleaved ? "load" : "save",
      };
      if (action.kind === "cases") {
        return {
          ...base,
          cases: { ...state.cases, sha: action.sha, dirty: fileDirty },
        };
      }
      return {
        ...base,
        templates: { ...state.templates, sha: action.sha, dirty: fileDirty },
      };
    }
    case "save:fail":
      return { ...state, saving: false };
  }
}

function safeParseArray<T>(text: string): T[] {
  if (!text.trim()) return [];
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("文件不是 JSON 数组");
  return parsed as T[];
}

/** Turn a GitHub write conflict into an actionable message (draft saved). */
function conflictError(): Error {
  return new Error(
    "远端文件已被其他提交更新（可能是 Hermes 并发发布）。本地改动已自动备份到草稿，" +
      "请先「从 GitHub 拉取最新」，再从侧栏「恢复草稿」找回改动并重新保存。",
  );
}

export function useAdminStore(token: string) {
  const [state, dispatch] = useReducer(reducer, initial);
  // Latest state in a ref so save callbacks can read current data without
  // listing `state` as a dependency — otherwise every keystroke recreates the
  // callbacks and the memoised store object, re-rendering all editor consumers.
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    if (!token) return;
    const snapshot = stateRef.current;
    if (snapshot.cases.dirty || snapshot.templates.dirty) {
      backupDraft(snapshot.cases.data, snapshot.templates.data);
      const ok = window.confirm(
        "有未保存的改动：已自动备份到本地草稿，确认后将用 GitHub 上的最新版本替换当前编辑。继续？",
      );
      if (!ok) return;
    }
    dispatch({ type: "load:start" });
    try {
      const [casesBlob, templatesBlob] = await Promise.all([
        readTextFile(REPO_TARGET, PATHS.cases, token),
        readTextFile(REPO_TARGET, PATHS.templates, token),
      ]);
      dispatch({
        type: "load:done",
        cases: {
          data: casesBlob ? safeParseArray<ManualCase>(casesBlob.text) : [],
          sha: casesBlob?.sha ?? null,
          dirty: false,
          revision: 0,
        },
        templates: {
          data: templatesBlob
            ? safeParseArray<ManualTemplate>(templatesBlob.text)
            : [],
          sha: templatesBlob?.sha ?? null,
          dirty: false,
          revision: 0,
        },
      });
    } catch (error) {
      dispatch({
        type: "load:fail",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [token]);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  // Clear the draft ONLY when a successful save made the store clean: at that
  // point the content is committed to GitHub, so the backup is obsolete.
  // A clean produced by refresh (cleanSource "load") keeps the draft — it is
  // the recovery point for the edits refresh just replaced (409 flow).
  const dirty = state.cases.dirty || state.templates.dirty;
  useEffect(() => {
    if (!dirty && state.cleanSource === "save") {
      clearDraft();
    }
  }, [dirty, state.cleanSource]);

  const setCases = useCallback((data: ManualCase[]) => {
    dispatch({ type: "cases:set", data });
  }, []);
  const setTemplates = useCallback((data: ManualTemplate[]) => {
    dispatch({ type: "templates:set", data });
  }, []);

  const saveCases = useCallback(
    async (message: string): Promise<void> => {
      dispatch({ type: "save:start" });
      const current = stateRef.current.cases;
      const savedRevision = current.revision;
      const savedLoadEpoch = stateRef.current.loadEpoch;
      // Back up before writing so a failed/conflicted save never loses edits.
      backupDraft(stateRef.current.cases.data, stateRef.current.templates.data);
      try {
        // Pretty-print so commits are diff-friendly.
        const text = JSON.stringify(current.data, null, 2) + "\n";
        const sha = await writeTextFile(
          REPO_TARGET,
          PATHS.cases,
          text,
          token,
          {
            message,
            sha: current.sha ?? undefined,
          },
        );
        dispatch({ type: "save:done", kind: "cases", sha, savedRevision, savedLoadEpoch });
      } catch (error) {
        dispatch({ type: "save:fail" });
        if (error instanceof GitHubError && error.status === 409) {
          throw conflictError();
        }
        throw error;
      }
    },
    [token],
  );

  const saveTemplates = useCallback(
    async (message: string): Promise<void> => {
      dispatch({ type: "save:start" });
      const current = stateRef.current.templates;
      const savedRevision = current.revision;
      const savedLoadEpoch = stateRef.current.loadEpoch;
      backupDraft(stateRef.current.cases.data, stateRef.current.templates.data);
      try {
        const text = JSON.stringify(current.data, null, 2) + "\n";
        const sha = await writeTextFile(
          REPO_TARGET,
          PATHS.templates,
          text,
          token,
          {
            message,
            sha: current.sha ?? undefined,
          },
        );
        dispatch({ type: "save:done", kind: "templates", sha, savedRevision, savedLoadEpoch });
      } catch (error) {
        dispatch({ type: "save:fail" });
        if (error instanceof GitHubError && error.status === 409) {
          throw conflictError();
        }
        throw error;
      }
    },
    [token],
  );

  /** Replace in-memory data with the localStorage draft (marks dirty). */
  const restoreDraft = useCallback((): boolean => {
    const draft = readDraft();
    if (!draft) return false;
    dispatch({ type: "cases:set", data: draft.cases });
    dispatch({ type: "templates:set", data: draft.templates });
    return true;
  }, []);

  return useMemo(
    () => ({
      ...state,
      dirty,
      refresh,
      setCases,
      setTemplates,
      saveCases,
      saveTemplates,
      restoreDraft,
    }),
    [state, dirty, refresh, setCases, setTemplates, saveCases, saveTemplates, restoreDraft],
  );
}
