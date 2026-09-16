import {
  canPickDesktopFolder,
  pickDesktopFolder,
} from "../../utils/desktopFolder";

/** Native folder picker on desktop; `null` when cancelled or unavailable. */
export async function pickKnowledgeFolder(): Promise<string | null> {
  return pickDesktopFolder();
}

export function canPickKnowledgeFolder(): boolean {
  return canPickDesktopFolder();
}
