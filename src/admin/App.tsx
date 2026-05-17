import { useEffect, useState } from "react";
import { isUnlocked, readToken, saveToken } from "./auth";
import { REPO_TARGET } from "./config";
import { checkToken } from "./github";
import { Lock } from "./ui/Lock";
import { Connect } from "./ui/Connect";
import { Shell } from "./ui/Shell";
import { ToastHost } from "./ui/Toast";

type Stage =
  | { kind: "locked" }
  | { kind: "connecting"; verifying: boolean; error?: string }
  | { kind: "ready"; token: string; login: string };

/**
 * Top-level admin app. Drives the three-stage flow:
 *   1. Password gate (in-browser hash compare)
 *   2. GitHub PAT entry / verification
 *   3. Editor shell, which owns its own data store
 */
export function AdminApp() {
  const [stage, setStage] = useState<Stage>(() =>
    isUnlocked() ? { kind: "connecting", verifying: false } : { kind: "locked" },
  );

  // After unlocking, try to silently verify any token previously saved in the
  // current session so the user lands directly on the editor when reloading.
  useEffect(() => {
    if (stage.kind !== "connecting" || stage.verifying) return;
    const cached = readToken();
    if (!cached) return;
    setStage({ kind: "connecting", verifying: true });
    checkToken(REPO_TARGET, cached)
      .then(({ login }) => {
        setStage({ kind: "ready", token: cached, login });
      })
      .catch((e) => {
        // Token expired or invalid — wipe and prompt for a new one.
        saveToken("");
        setStage({
          kind: "connecting",
          verifying: false,
          error: e instanceof Error ? e.message : "Token 验证失败",
        });
      });
    // We only want this to run on the first connecting transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind]);

  if (stage.kind === "locked") {
    return (
      <Lock
        onUnlock={() => setStage({ kind: "connecting", verifying: false })}
      />
    );
  }

  if (stage.kind === "connecting") {
    if (stage.verifying) {
      return (
        <div className="flex min-h-screen items-center justify-center text-ink-400">
          <span className="inline-flex items-center gap-2 text-[13px]">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-500" />
            验证 GitHub Token…
          </span>
        </div>
      );
    }
    return (
      <ToastHost>
        <Connect
          onConnected={(token, login) => {
            setStage({ kind: "ready", token, login });
          }}
        />
      </ToastHost>
    );
  }

  return (
    <ToastHost>
      <Shell
        token={stage.token}
        login={stage.login}
        onSignOut={() => {
          saveToken("");
          setStage({ kind: "locked" });
        }}
      />
    </ToastHost>
  );
}
