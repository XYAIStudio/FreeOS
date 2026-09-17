/**
 * CORS helpers for the local sidecar.
 *
 * Login POSTs from the page at http://127.0.0.1:3780 send Origin: that same
 * URL. FreeOS used to allow only the dashboard ports (8088 / 18900), so the
 * cors() callback threw and the global handler returned the opaque
 * 「服务器内部错误，请稍后重试或联系管理员」. Always merge the listen origin
 * and treat same-host Origin as allowed. Unknown origins are rejected
 * without throwing (no 500).
 */

export function sidecarSelfOrigins(port: string | number): string[] {
  const p = String(port).trim() || "3780";
  return [
    `http://127.0.0.1:${p}`,
    `http://localhost:${p}`,
    `http://[::1]:${p}`,
  ];
}

export function mergeCorsOrigins(
  configured: readonly string[],
  port: string | number,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const origin of [...configured, ...sidecarSelfOrigins(port)]) {
    const clean = origin.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

export function parseOriginList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowed: readonly string[],
  reqHost?: string,
): boolean {
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  if (reqHost) {
    try {
      const parsed = new URL(origin);
      const host = reqHost.split(",")[0]?.trim();
      if (host && parsed.host === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** True when every listen-origin (127.0.0.1 / localhost / [::1]) is allowed. */
export function corsAllowsSelf(
  allowed: readonly string[],
  port: string | number,
  reqHost?: string,
): boolean {
  return sidecarSelfOrigins(port).every((origin) =>
    isAllowedCorsOrigin(origin, allowed, reqHost),
  );
}
