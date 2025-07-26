import { describe, expect, it } from "bun:test";
import type { WebSearchPreToolUseInput } from "../../types/hook";
import type { WebSearchRule } from "../preToolUse";
import { handleWebSearchTool } from "./webSearch";

describe("handleWebSearchTool", () => {
  const createInput = (query: string): WebSearchPreToolUseInput => ({
    hook_event_name: "PreToolUse",
    session_id: "test-session",
    transcript_path: "/tmp/test",
    cwd: "/tmp",
    tool_name: "WebSearch",
    tool_input: {
      query,
    },
  });

  it("空のルールの場合は空のレスポンスを返す", () => {
    const input = createInput("test query");
    const result = handleWebSearchTool(input, []);
    expect(result).toEqual({});
  });

  it("デフォルトでapproveする", () => {
    const input = createInput("test query");
    const rules: WebSearchRule[] = [
      {
        tool: "WebSearch",
        decision: "approve",
        reason: "基本的にsearch ok",
      },
    ];
    const result = handleWebSearchTool(input, rules);
    expect(result).toEqual({
      decision: "approve",
      reason: "基本的にsearch ok",
    });
  });

  it("特定のクエリをblockする", () => {
    const input = createInput("claude ai assistant");
    const rules: WebSearchRule[] = [
      {
        tool: "WebSearch",
        decision: "approve",
        reason: "基本的にsearch ok",
      },
      {
        tool: "WebSearch",
        decision: "block",
        query: "claude",
        reason: "ここはsearch不可",
      },
    ];
    const result = handleWebSearchTool(input, rules);
    expect(result).toEqual({
      decision: "block",
      reason: "ここはsearch不可",
    });
  });

  it("正規表現でクエリをマッチする", () => {
    const input = createInput("How to use Claude API");
    const rules: WebSearchRule[] = [
      {
        tool: "WebSearch",
        decision: "block",
        query: "Claude", // 正規表現でマッチ
        reason: "Claudeを含む検索はブロック",
      },
    ];
    const result = handleWebSearchTool(input, rules);
    expect(result).toEqual({
      decision: "block",
      reason: "Claudeを含む検索はブロック",
    });
  });

  it("文字列として部分一致する", () => {
    const input = createInput("search for [invalid regex");
    const rules: WebSearchRule[] = [
      {
        tool: "WebSearch",
        decision: "block",
        query: "[invalid", // 無効な正規表現
        reason: "無効な正規表現を含む検索はブロック",
      },
    ];
    const result = handleWebSearchTool(input, rules);
    expect(result).toEqual({
      decision: "block",
      reason: "無効な正規表現を含む検索はブロック",
    });
  });

  it("後に定義されたルールが優先される", () => {
    const input = createInput("claude test");
    const rules: WebSearchRule[] = [
      {
        tool: "WebSearch",
        decision: "block",
        query: "claude",
        reason: "最初のルール",
      },
      {
        tool: "WebSearch",
        decision: "approve",
        query: "claude",
        reason: "後のルール",
      },
    ];
    const result = handleWebSearchTool(input, rules);
    expect(result).toEqual({
      decision: "approve",
      reason: "後のルール",
    });
  });

  it("複数のルールがマッチした場合はblockが優先される", () => {
    const input = createInput("test query");
    const rules: WebSearchRule[] = [
      {
        tool: "WebSearch",
        decision: "approve",
        reason: "デフォルトapprove",
      },
      {
        tool: "WebSearch",
        decision: "block",
        query: "test",
        reason: "testを含むクエリはblock",
      },
    ];
    const result = handleWebSearchTool(input, rules);
    expect(result).toEqual({
      decision: "block",
      reason: "testを含むクエリはblock",
    });
  });

  it("decisionがundefinedの場合はreasonのみ返す", () => {
    const input = createInput("test query");
    const rules: WebSearchRule[] = [{ tool: "WebSearch", reason: "理由のみ" }];
    const result = handleWebSearchTool(input, rules);
    expect(result).toEqual({
      reason: "理由のみ",
    });
  });
});
