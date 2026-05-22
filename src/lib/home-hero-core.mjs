export const DEFAULT_HERO_LIMIT = 5;
export const DEFAULT_HERO_POOL_LIMIT = 120;

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.floor(number);
}

function normalizeSeed(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return Math.abs(Math.floor(seed));
  }
  if (typeof seed === "string" && seed.trim()) {
    return hashString(seed);
  }
  return 0;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createHeroSeed() {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoObject.getRandomValues(values);
    return values[0] || Date.now();
  }
  return Math.floor(Math.random() * 0xffffffff);
}

export function selectHeroCases(cases, options = {}) {
  if (!Array.isArray(cases) || cases.length === 0) return [];

  const limit = normalizePositiveInteger(options.limit, DEFAULT_HERO_LIMIT);
  if (limit <= 0) return [];
  if (cases.length <= limit) return cases.slice();

  const poolLimit = normalizePositiveInteger(options.poolLimit, DEFAULT_HERO_POOL_LIMIT);
  const poolSize = Math.min(cases.length, Math.max(limit, poolLimit));
  const pool = cases.slice(0, poolSize);
  const seed = normalizeSeed(options.seed);

  return pool
    .map((item, index) => {
      const stableId = item?.id ?? item?.slug ?? index;
      return {
        item,
        index,
        score: hashString(`${seed}:${stableId}:${index}`),
      };
    })
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
}
