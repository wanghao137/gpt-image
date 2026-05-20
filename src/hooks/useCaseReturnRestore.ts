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

  return { restoreId, onRestored };
}
