/**
 * Release entry. Demo accounts and demo rows live in backend/dev/demo-seed.ts,
 * which the sidecar bundle excludes. FREEOS_ORG_LOCAL_TEST inherited from a
 * parent process is not enough; FREEOS_DEV_BUILD must be set as well.
 */
function envTruthy(name: string): boolean {
  const value = (process.env[name] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function devSeedAllowed(): boolean {
  return envTruthy("FREEOS_DEV_BUILD");
}

export async function seedDatabase(): Promise<void> {
  if (!devSeedAllowed()) {
    console.log("[seed] Release build does not include demo seed data.");
    return;
  }
  const specifier = "./dev/demo-seed.ts";
  const mod = await import(specifier) as { seedDatabase: () => void };
  mod.seedDatabase();
}
