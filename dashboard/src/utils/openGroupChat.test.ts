import { beforeEach, describe, expect, it, vi } from "vitest";
import { GROUP_CHATS_KEY, type GroupChatRecord } from "./groupChats";
import { GroupMembersRequiredError, openGroupChat } from "./openGroupChat";

vi.mock("../api/modules/octopThreads", () => ({
  octopThreadsApi: {
    create: vi.fn(async () => ({ thread_id: "t-new" })),
    rename: vi.fn(async () => undefined),
  },
}));

import { octopThreadsApi } from "../api/modules/octopThreads";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    data,
  };
}

const existing: GroupChatRecord = {
  id: "g1",
  threadId: "t1",
  hostAgentId: "a1",
  memberIds: ["a1", "a2"],
  title: "周会",
  createdAt: 1,
  lastActive: 2,
};

describe("openGroupChat", () => {
  beforeEach(() => {
    vi.mocked(octopThreadsApi.create).mockClear();
    vi.mocked(octopThreadsApi.rename).mockClear();
  });

  it("reuses an existing group with the same members", async () => {
    const storage = memoryStorage({
      [GROUP_CHATS_KEY]: JSON.stringify([existing]),
    });
    const result = await openGroupChat({
      memberIds: ["a2", "a1"],
      memberNames: ["分析师", "研究员"],
      storage,
    });
    expect(result.created).toBe(false);
    expect(result.record.threadId).toBe("t1");
    expect(octopThreadsApi.create).not.toHaveBeenCalled();
  });

  it("creates a thread when no matching group exists", async () => {
    const storage = memoryStorage();
    const result = await openGroupChat({
      memberIds: ["a1", "a2"],
      memberNames: ["分析师", "研究员"],
      title: "周会",
      storage,
      now: 10,
    });
    expect(result.created).toBe(true);
    expect(result.record).toMatchObject({
      threadId: "t-new",
      hostAgentId: "a1",
      memberIds: ["a1", "a2"],
      title: "周会",
    });
    expect(octopThreadsApi.create).toHaveBeenCalledWith("a1");
    expect(octopThreadsApi.rename).toHaveBeenCalledWith("a1", "t-new", "周会");
  });

  it("rejects a single member", async () => {
    await expect(
      openGroupChat({
        memberIds: ["a1"],
        memberNames: ["分析师"],
        storage: memoryStorage(),
      }),
    ).rejects.toBeInstanceOf(GroupMembersRequiredError);
  });
});
