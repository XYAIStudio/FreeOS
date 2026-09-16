/** Heuristics for splitting usage buckets into local vs cloud models. */

const LOCAL_HINTS = [
  "ollama",
  "gguf",
  "localhost",
  "127.0.0.1",
  ":11434",
  "lmstudio",
  "lm studio",
  "llama.cpp",
  "onnx",
  "local/",
  "local:",
];

export function isLocalModelKey(value: string): boolean {
  const key = value.trim().toLowerCase();
  if (!key) return false;
  return LOCAL_HINTS.some((hint) => key.includes(hint));
}

export function splitLocalCloudTokens(
  buckets: Array<{ key: string; label?: string; total_tokens: number }>,
): { local: number; cloud: number } {
  let local = 0;
  let cloud = 0;
  for (const bucket of buckets) {
    const tokens = bucket.total_tokens || 0;
    if (isLocalModelKey(bucket.key) || isLocalModelKey(bucket.label || "")) {
      local += tokens;
    } else {
      cloud += tokens;
    }
  }
  return { local, cloud };
}
