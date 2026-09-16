import { octopThreadsApi } from "../api/modules/octopThreads";
import {
  findGroupChatByMembers,
  groupChatTitle,
  saveGroupChat,
  touchGroupChat,
  uniqueMemberIds,
  type GroupChatRecord,
} from "./groupChats";

export class GroupMembersRequiredError extends Error {
  constructor() {
    super("GROUP_MEMBERS_REQUIRED");
    this.name = "GroupMembersRequiredError";
  }
}

export async function openGroupChat(options: {
  memberIds: string[];
  memberNames: string[];
  title?: string;
  storage?: Pick<Storage, "getItem" | "setItem">;
  now?: number;
}): Promise<{ record: GroupChatRecord; created: boolean }> {
  const memberIds = uniqueMemberIds(options.memberIds);
  if (memberIds.length < 2) {
    throw new GroupMembersRequiredError();
  }

  const storage = options.storage ?? window.localStorage;
  const existing = findGroupChatByMembers(memberIds, storage);
  if (existing) {
    touchGroupChat(existing.threadId, storage);
    return { record: existing, created: false };
  }

  const hostId = memberIds[0];
  const created = await octopThreadsApi.create(hostId);
  const title = groupChatTitle(options.title, options.memberNames);
  await octopThreadsApi.rename(hostId, created.thread_id, title);
  const now = options.now ?? Date.now();
  const record: GroupChatRecord = {
    id: created.thread_id,
    threadId: created.thread_id,
    hostAgentId: hostId,
    memberIds,
    title,
    createdAt: now,
    lastActive: now,
  };
  saveGroupChat(record, storage);
  return { record, created: true };
}
