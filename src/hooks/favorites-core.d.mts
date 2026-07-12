export function parseFavoriteIds(raw: unknown): Set<string>;
export function persistFavoriteIds(
  write: (value: string) => void,
  ids: Iterable<string>,
): boolean;
