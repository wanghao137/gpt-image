import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { caseReturnPath, clearCaseReturn, readCaseReturn } from "../lib/caseReturn";

export function useCaseReturnRestore() {
  const location = useLocation();
  const [restoreId, setRestoreId] = useState<string | null>(() => {
    const target = readCaseReturn();
    return target?.path === caseReturnPath(location) ? target.id : null;
  });

  useEffect(() => {
    const target = readCaseReturn();
    setRestoreId(target?.path === caseReturnPath(location) ? target.id : null);
  }, [location]);

  const onRestored = useCallback(() => {
    clearCaseReturn();
    setRestoreId(null);
  }, []);

  return { restoreId, onRestored };
}
