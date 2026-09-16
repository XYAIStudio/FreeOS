import { describe, expect, it } from "vitest";
import { buildMentionItems, firstFileMentionIndex } from "./MentionPickerMenu";

describe("buildMentionItems", () => {
  it("adds @所有人 when more than one expert can be mentioned", () => {
    const items = buildMentionItems(
      "",
      [],
      [
        { agent_id: "a1", name: "分析师" },
        { agent_id: "a2", name: "研究员" },
      ],
      [],
      [],
      { everyoneLabel: "所有人" },
    );
    expect(items[0]).toEqual({
      kind: "everyone",
      label: "所有人",
      token: "所有人",
    });
  });

  it("includes installed subagents as @slug picks", () => {
    const items = buildMentionItems(
      "",
      [],
      [],
      [
        {
          slug: "researcher",
          name: "研究员",
          path: "agents/researcher.md",
          emoji: "🔎",
        },
      ],
    );
    expect(items).toEqual([
      { kind: "subagent", slug: "researcher", label: "研究员" },
    ]);
  });

  it("does not preload leftover files on an empty query", () => {
    const items = buildMentionItems(
      "",
      [],
      [],
      [],
      [{ path: "docs/api.md", label: "api.md" }],
    );
    expect(items).toEqual([]);
  });

  it("appends workspace files after people unless the query looks like a path", () => {
    const connector = {
      mcp_server_name: "notes",
      label: "Notes for api.md",
      kind: "http",
    };
    const file = { path: "docs/api.md", label: "api.md" };
    expect(
      buildMentionItems("api", [connector], [], [], [file]).map(
        (item) => item.kind,
      ),
    ).toEqual(["connector", "file"]);
    expect(
      buildMentionItems("api.md", [connector], [], [], [file], {
        filesFirst: true,
      }).map((item) => item.kind),
    ).toEqual(["file", "connector"]);
    expect(
      firstFileMentionIndex(
        buildMentionItems("api.md", [connector], [], [], [file], {
          filesFirst: true,
        }),
      ),
    ).toBe(0);
  });
});
