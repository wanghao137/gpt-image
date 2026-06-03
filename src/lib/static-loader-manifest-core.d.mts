export function isStaticLoaderManifestUrl(input: unknown): boolean;

export function coerceStaticLoaderManifestResponse(
  response: Response,
  input: unknown,
): Promise<Response>;

export function installStaticLoaderManifestGuard(win?: Window): boolean;
