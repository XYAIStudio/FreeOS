/** Right-rail / composer + panel types in 开发空间. */

export const WORKSPACE_PANEL_KINDS = [
  "files",
  "review",
  "tasks",
  "browser",
  "terminal",
] as const;

export type WorkspacePanelKind = (typeof WORKSPACE_PANEL_KINDS)[number];

export function isWorkspacePanelKind(
  value: unknown,
): value is WorkspacePanelKind {
  return (
    value === "files" ||
    value === "review" ||
    value === "tasks" ||
    value === "browser" ||
    value === "terminal"
  );
}
