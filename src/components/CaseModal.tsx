/**
 * Legacy CaseModal: superseded by /case/:slug pages, kept as a no-op shim
 * so any leftover imports don't break the type-check during the migration.
 * Once the build is green this file can be deleted entirely.
 */
export function CaseModal(): null {
  return null;
}
