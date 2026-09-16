export interface GroupChatRecord {
  id: string;
  threadId: string;
  hostAgentId: string;
  memberIds: string[];
  title: string;
  createdAt: number;
  lastActive: number;
}

export const GROUP_CHATS_KEY = "freeos:group-chats";

export function loadGroupChats(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): GroupChatRecord[] {
  try {
    const raw = storage.getItem(GROUP_CHATS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGroupChatRecord);
  } catch {
    return [];
  }
}

export function saveGroupChat(
  record: GroupChatRecord,
  storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage,
): GroupChatRecord[] {
  const next = [
    record,
    ...loadGroupChats(storage).filter((item) => item.id !== record.id),
  ].sort((a, b) => b.lastActive - a.lastActive);
  storage.setItem(GROUP_CHATS_KEY, JSON.stringify(next));
  return next;
}

export function touchGroupChat(
  threadId: string,
  storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage,
): GroupChatRecord[] {
  const current = loadGroupChats(storage);
  const now = Date.now();
  const next = current.map((item) =>
    item.threadId === threadId ? { ...item, lastActive: now } : item,
  );
  storage.setItem(GROUP_CHATS_KEY, JSON.stringify(next));
  return next;
}

export function groupChatTitle(
  title: string | undefined,
  memberNames: string[],
): string {
  const trimmed = title?.trim() ?? "";
  if (trimmed) return trimmed;
  if (memberNames.length === 0) return "群聊";
  return memberNames.slice(0, 4).join("、");
}

function isGroupChatRecord(value: unknown): value is GroupChatRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as GroupChatRecord;
  return (
    typeof row.id === "string" &&
    typeof row.threadId === "string" &&
    typeof row.hostAgentId === "string" &&
    Array.isArray(row.memberIds)
  );
}
