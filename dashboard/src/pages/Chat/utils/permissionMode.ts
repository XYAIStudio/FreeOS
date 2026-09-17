/** Composer / turn permission modes for desktop chat. */

export const CHAT_PERMISSION_MODES = ["default", "auto", "full"] as const;

export type ChatPermissionMode = (typeof CHAT_PERMISSION_MODES)[number];

const WORKSPACE_KEY = "octop:chat-permission-mode";

export function isChatPermissionMode(value: unknown): value is ChatPermissionMode {
  return (
    value === "default" || value === "auto" || value === "full"
  );
}

function threadKey(threadId: string): string {
  return `${WORKSPACE_KEY}:${threadId}`;
}

function readStored(key: string): ChatPermissionMode | null {
  try {
    const raw = localStorage.getItem(key);
    return isChatPermissionMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, mode: ChatPermissionMode): void {
  try {
    localStorage.setItem(key, mode);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Thread selection wins; otherwise the last workspace-wide choice. */
export function loadPermissionMode(
  threadId?: string | null,
): ChatPermissionMode {
  const tid = threadId?.trim();
  if (tid) {
    const perThread = readStored(threadKey(tid));
    if (perThread) return perThread;
  }
  return readStored(WORKSPACE_KEY) ?? "default";
}

/** Persist for this conversation and as the workspace default. */
export function savePermissionMode(
  mode: ChatPermissionMode,
  threadId?: string | null,
): void {
  writeStored(WORKSPACE_KEY, mode);
  const tid = threadId?.trim();
  if (tid) writeStored(threadKey(tid), mode);
}
