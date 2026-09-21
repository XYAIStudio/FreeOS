/** Desktop Org is always the openXYOS module embed. Missing runtime is not a workspace fallback. */

export function shouldEmbedOpenXYOS(input: {
  desktop: boolean;
  integrated: boolean | null;
}): boolean {
  if (input.desktop) return true;
  return input.integrated === true;
}

export function shouldFallbackToHostWorkspace(input: {
  desktop: boolean;
  integrated: boolean | null;
}): boolean {
  if (input.desktop) return false;
  return input.integrated === false;
}
