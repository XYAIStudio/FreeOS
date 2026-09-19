/** Catalog keys that have a shared org-ui page (keep in sync with contract.py). */
export const SHARED_ORG_UI_MODULES = [
  "announcements",
  "organization",
  "employees",
  "skills",
  "governance",
  "knowledge",
] as const;

export type SharedOrgUiModule = (typeof SHARED_ORG_UI_MODULES)[number];
