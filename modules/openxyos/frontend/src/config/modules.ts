export const TENANT_MODULE_KEYS = [
  "announcements", "organization", "employees", "skills", "chat", "tasks", "workflows",
  "contracts", "assets", "attendance", "expenses", "work_records", "goals", "budgets",
  "performance", "efficiency", "reflections", "knowledge", "governance", "audit",
] as const;

export type TenantModuleKey = typeof TENANT_MODULE_KEYS[number];

export const DEFAULT_MODULE_STATE = Object.fromEntries(
  TENANT_MODULE_KEYS.map(key => [key, true])
) as Record<TenantModuleKey, boolean>;
