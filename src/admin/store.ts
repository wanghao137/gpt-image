/**
 * Admin data store — a tiny custom hook that owns the in-memory copies of the
 * two manual JSON files plus their server SHAs. We keep this deliberately
 * framework-light: no Redux, no context, just useReducer + a couple of
 * GitHub helpers.
 */

import { useCallback, useEffect, useMemo, useReducer } from "react";
import { PATHS, REPO_TARGET } from "./config";
import { readTextFile, writeTextFile } from "./github";
import type { ManualCase, ManualTemplate, FileState } from "./types";

interface State {
  cases: FileState<ManualCase[]>;
  templates: FileState<ManualTemplate[]>;
  loading: boolean;
  loadError: string;
  saving: boolean;
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
    }
  | { type: "save:fail" };

const empty = <T,>(data: T): FileState<T> => ({ data, sha: null, dirty: false });

const initial: State = {
  cases: empty<ManualCase[]>([]),
  templates: empty<ManualTemplate[]>([]),
  loading: false,
  loadError: "",
  saving: false,
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
      };
    case "load:fail":
      return { ...state, loading: false, loadError: action.error };
    case "cases:set":
      return {
        ...state,
        cases: { ...state.cases, data: action.data, dirty: true },
      };
    case "templates:set":
      return {
        ...state,
        templates: { ...state.templates, data: action.data, dirty: true },
      };
    case "save:start":
      return { ...state, saving: true };
    case "save:done":
      if (action.kind === "cases") {
        return {
          ...state,
          saving: false,
          cases: { ...state.cases, sha: action.sha, dirty: false },
        };
      }
      return {
        ...state,
        saving: false,
        templates: { ...state.templates, sha: action.sha, dirty: false },
      };
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

export function useAdminStore(token: string) {
  const [state, dispatch] = useReducer(reducer, initial);

  const refresh = useCallback(async () => {
    if (!token) return;
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
        },
        templates: {
          data: templatesBlob
            ? safeParseArray<ManualTemplate>(templatesBlob.text)
            : [],
          sha: templatesBlob?.sha ?? null,
          dirty: false,
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

  const setCases = useCallback((data: ManualCase[]) => {
    dispatch({ type: "cases:set", data });
  }, []);
  const setTemplates = useCallback((data: ManualTemplate[]) => {
    dispatch({ type: "templates:set", data });
  }, []);

  const saveCases = useCallback(
    async (message: string): Promise<void> => {
      dispatch({ type: "save:start" });
      try {
        // Pretty-print so commits are diff-friendly.
        const text = JSON.stringify(state.cases.data, null, 2) + "\n";
        const sha = await writeTextFile(
          REPO_TARGET,
          PATHS.cases,
          text,
          token,
          {
            message,
            sha: state.cases.sha ?? undefined,
          },
        );
        dispatch({ type: "save:done", kind: "cases", sha });
      } catch (error) {
        dispatch({ type: "save:fail" });
        throw error;
      }
    },
    [state.cases, token],
  );

  const saveTemplates = useCallback(
    async (message: string): Promise<void> => {
      dispatch({ type: "save:start" });
      try {
        const text = JSON.stringify(state.templates.data, null, 2) + "\n";
        const sha = await writeTextFile(
          REPO_TARGET,
          PATHS.templates,
          text,
          token,
          {
            message,
            sha: state.templates.sha ?? undefined,
          },
        );
        dispatch({ type: "save:done", kind: "templates", sha });
      } catch (error) {
        dispatch({ type: "save:fail" });
        throw error;
      }
    },
    [state.templates, token],
  );

  const dirty = state.cases.dirty || state.templates.dirty;

  return useMemo(
    () => ({
      ...state,
      dirty,
      refresh,
      setCases,
      setTemplates,
      saveCases,
      saveTemplates,
    }),
    [state, dirty, refresh, setCases, setTemplates, saveCases, saveTemplates],
  );
}
