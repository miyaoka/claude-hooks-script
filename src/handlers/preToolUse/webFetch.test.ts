import { describe, expect, it } from "bun:test";
import type { WebFetchPreToolUseInput } from "../../types/hook";
import type { PreToolUseRule } from "../preToolUse";
import { handleWebFetchTool } from "./webFetch";

describe("handleWebFetchTool", () => {
  const createInput = (url: string): WebFetchPreToolUseInput => ({
    hook_event_name: "PreToolUse",
    session_id: "test-session",
    transcript_path: "/tmp/test",
    cwd: "/tmp",
    tool_name: "WebFetch",
    tool_input: {
      url,
      prompt: "test prompt",
    },
  });

  it("空のルールの場合は空のレスポンスを返す", () => {
    const input = createInput("https://example.com");
    const result = handleWebFetchTool(input, []);
    expect(result).toEqual({});
  });

  it("WebFetch以外のルールは無視する", () => {
    const input = createInput("https://example.com");
    const rules: PreToolUseRule[] = [
      { matcher: "Bash", decision: "block", reason: "Bash rule" },
    ];
    const result = handleWebFetchTool(input, rules);
    expect(result).toEqual({});
  });

  it("デフォルトでapproveする", () => {
    const input = createInput("https://example.com");
    const rules: PreToolUseRule[] = [
      { matcher: "WebFetch", decision: "approve", reason: "基本的にfetch ok" },
    ];
    const result = handleWebFetchTool(input, rules);
    expect(result).toEqual({
      decision: "approve",
      reason: "基本的にfetch ok",
    });
  });

  it("特定のドメインをblockする", () => {
    const input = createInput("https://www.google.com/search");
    const rules: PreToolUseRule[] = [
      { matcher: "WebFetch", decision: "approve", reason: "基本的にfetch ok" },
      {
        matcher: "WebFetch",
        decision: "block",
        domain: "www\\.google\\.com",
        reason: "ここはfetch不可",
      },
    ];
    const result = handleWebFetchTool(input, rules);
    expect(result).toEqual({
      decision: "block",
      reason: "ここはfetch不可",
    });
  });

  it("正規表現でドメインをマッチする", () => {
    const input = createInput("https://sub.example.com/page");
    const rules: PreToolUseRule[] = [
      {
        matcher: "WebFetch",
        decision: "block",
        domain: ".*\\.example\\.com",
        reason: "example.comのサブドメインは全てブロック",
      },
    ];
    const result = handleWebFetchTool(input, rules);
    expect(result).toEqual({
      decision: "block",
      reason: "example.comのサブドメインは全てブロック",
    });
  });

  it("後に定義されたルールが優先される", () => {
    const input = createInput("https://www.google.com");
    const rules: PreToolUseRule[] = [
      {
        matcher: "WebFetch",
        decision: "block",
        domain: "www\\.google\\.com",
        reason: "最初のルール",
      },
      {
        matcher: "WebFetch",
        decision: "approve",
        domain: "www\\.google\\.com",
        reason: "後のルール",
      },
    ];
    const result = handleWebFetchTool(input, rules);
    expect(result).toEqual({
      decision: "approve",
      reason: "後のルール",
    });
  });

  it("複数のルールがマッチした場合はblockが優先される", () => {
    const input = createInput("https://example.com");
    const rules: PreToolUseRule[] = [
      { matcher: "WebFetch", decision: "approve", reason: "デフォルトapprove" },
      {
        matcher: "WebFetch",
        decision: "block",
        domain: "example\\.com",
        reason: "example.comはblock",
      },
    ];
    const result = handleWebFetchTool(input, rules);
    expect(result).toEqual({
      decision: "block",
      reason: "example.comはblock",
    });
  });

  it("無効なURLの場合は空のレスポンスを返す", () => {
    const input = createInput("not-a-valid-url");
    const rules: PreToolUseRule[] = [
      { matcher: "WebFetch", decision: "block", reason: "全てblock" },
    ];
    const result = handleWebFetchTool(input, rules);
    expect(result).toEqual({});
  });

  it("decisionがundefinedの場合はreasonのみ返す", () => {
    const input = createInput("https://example.com");
    const rules: PreToolUseRule[] = [
      { matcher: "WebFetch", reason: "理由のみ" },
    ];
    const result = handleWebFetchTool(input, rules);
    expect(result).toEqual({
      reason: "理由のみ",
    });
  });
});
