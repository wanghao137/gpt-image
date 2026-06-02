import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { caseReturnPath, clearCaseReturn, readCaseReturn, type CaseReturnTarget } from "../lib/caseReturn";

export function useCaseReturnRestore() {
  const location = useLocation();
  const [restoreTarget, setRestoreTarget] = useState<CaseReturnTarget | null>(() => {
    const target = readCaseReturn();
    return target?.path === caseReturnPath(location) ? target : null;
  });

  useEffect(() => {
    const target = readCaseReturn();
    setRestoreTarget(target?.path === caseReturnPath(location) ? target : null);
  }, [location]);

  const onRestored = useCallback(() => {
    clearCaseReturn();
    setRestoreTarget(null);
  }, []);

  return { restoreId: restoreTarget?.id ?? null, restoreTarget, onRestored };
}
