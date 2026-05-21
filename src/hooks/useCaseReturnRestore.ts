import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { clearCaseReturn, readCaseReturn } from "../lib/caseReturn";

function locationPath(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function useCaseReturnRestore() {
  const location = useLocation();
  const [restoreId, setRestoreId] = useState<string | null>(() => {
    const target = readCaseReturn();
    return target?.path === locationPath(location) ? target.id : null;
  });

  useEffect(() => {
    const target = readCaseReturn();
    setRestoreId(target?.path === locationPath(location) ? target.id : null);
  }, [location]);

  const onRestored = useCallback(() => {
    clearCaseReturn();
    setRestoreId(null);
  }, []);

  useEffect(() => {
    if (!restoreId) return;
    let done = false;
    const timers: number[] = [];
    const scrollToTarget = () => {
      if (done) return;
      const el = document.getElementById(`case-${restoreId}`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "auto" });
    };
    const finish = () => {
      if (done) return;
      scrollToTarget();
      done = true;
      onRestored();
    };
    scrollToTarget();
    [80, 180, 350, 700, 1200, 1800, 2400].forEach((delay) => {
      timers.push(window.setTimeout(scrollToTarget, delay));
    });
    timers.push(window.setTimeout(finish, 2600));
    return () => {
      done = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [onRestored, restoreId]);

  return { restoreId, onRestored };
}
