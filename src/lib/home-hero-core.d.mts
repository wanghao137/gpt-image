export const DEFAULT_HERO_LIMIT: 5;
export const DEFAULT_HERO_POOL_LIMIT: 120;

export interface HeroCaseSelectionOptions {
  limit?: number;
  poolLimit?: number;
  seed?: number | string;
}

export function createHeroSeed(): number;
export function selectHeroCases<T>(
  cases: readonly T[],
  options?: HeroCaseSelectionOptions,
): T[];
