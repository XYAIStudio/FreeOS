/**
 * Resolve where to save the latest openXYOS source zip.
 * Desktop: native folder picker (any drive). Browser: typed path fallback.
 */
export async function resolveOpenxyosSourceDest(options: {
  canPickNative: boolean;
  pickNative: () => Promise<string | null>;
  typedDest: string;
}): Promise<string | null> {
  if (options.canPickNative) {
    const picked = await options.pickNative();
    return picked && picked.trim() ? picked.trim() : null;
  }
  const typed = options.typedDest.trim();
  return typed || null;
}
