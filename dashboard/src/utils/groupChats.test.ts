import { describe, expect, it } from "vitest";
import {
  GROUP_CHATS_KEY,
  groupChatTitle,
  loadGroupChats,
  saveGroupChat,
  type GroupChatRecord,
} from "./groupChats";

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

const sample: GroupChatRecord = {
  id: "g1",
  threadId: "t1",
  hostAgentId: "a1",
  memberIds: ["a1", "a2"],
  title: "周会",
  createdAt: 1,
  lastActive: 2,
};

describe("groupChats", () => {
  it("round-trips records through storage", () => {
    const storage = memoryStorage();
    saveGroupChat(sample, storage);
    expect(loadGroupChats(storage)).toEqual([sample]);
    expect(storage.data[GROUP_CHATS_KEY]).toContain("周会");
  });

  it("builds a default title from member names", () => {
    expect(groupChatTitle("", ["分析师", "研究员"])).toBe("分析师、研究员");
    expect(groupChatTitle(" 产品 ", ["A"])).toBe("产品");
  });
});
