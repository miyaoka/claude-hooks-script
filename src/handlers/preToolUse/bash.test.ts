import { describe, expect, it } from "bun:test";
import type { PreToolUseRule } from "../preToolUse";
import { handleBashTool } from "./bash";

describe("normalizeBashRules", () => {
  it("同じcommand, argsの組み合わせは後の定義で上書きされる", async () => {
    const rules: PreToolUseRule[] = [
      {
        matcher: "Bash",
        command: "rm",
        args: "/tmp/",
        decision: "block",
        reason: "最初の定義",
      },
      {
        matcher: "Bash",
        command: "rm",
        args: "/tmp/",
        decision: "approve",
        reason: "後の定義で上書き",
      },
    ];

    const input = {
      session_id: "test",
      transcript_path: "/tmp/transcript.json",
      cwd: "/test",
      hook_event_name: "PreToolUse" as const,
      tool_name: "Bash" as const,
      tool_input: {
        command: "rm /tmp/file.txt",
      },
    };

    const result = await handleBashTool(input, rules);

    // rmコマンドで/tmp/を含むので、後の定義（approve）が適用される
    expect(result).toEqual({
      decision: "approve",
      reason: "後の定義で上書き",
    });
  });

  it("異なるcommandは別のルールとして扱われる", async () => {
    const rules: PreToolUseRule[] = [
      {
        matcher: "Bash",
        command: "rm",
        decision: "block",
        reason: "rmコマンド",
      },
      {
        matcher: "Bash",
        command: "ls",
        decision: "approve",
        reason: "lsコマンド",
      },
    ];

    const input = {
      session_id: "test",
      transcript_path: "/tmp/transcript.json",
      cwd: "/test",
      hook_event_name: "PreToolUse" as const,
      tool_name: "Bash" as const,
      tool_input: {
        command: "ls -la",
      },
    };

    const result = await handleBashTool(input, rules);

    expect(result).toEqual({
      decision: "approve",
      reason: "lsコマンド",
    });
  });

  it("異なるargsは別のルールとして扱われる", async () => {
    const rules: PreToolUseRule[] = [
      {
        matcher: "Bash",
        command: "rm",
        args: "/tmp/",
        decision: "approve",
        reason: "tmpディレクトリ",
      },
      {
        matcher: "Bash",
        command: "rm",
        args: "/etc/",
        decision: "block",
        reason: "etcディレクトリ",
      },
    ];

    const inputEtc = {
      session_id: "test",
      transcript_path: "/tmp/transcript.json",
      cwd: "/test",
      hook_event_name: "PreToolUse" as const,
      tool_name: "Bash" as const,
      tool_input: {
        command: "rm /etc/passwd",
      },
    };

    const resultEtc = await handleBashTool(inputEtc, rules);

    expect(resultEtc).toEqual({
      decision: "block",
      reason: "etcディレクトリ",
    });
  });
});
