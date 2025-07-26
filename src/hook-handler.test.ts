import { test, expect, describe, spyOn } from "bun:test";
import { processHook } from "./hook-handler";
import * as handlers from "./handlers";
import type { HookInput } from "./types";

describe("hook処理", () => {
  test("PreToolUse hookが正しく処理される", async () => {
    // Arrange
    const input: HookInput = {
      session_id: "test-session",
      transcript_path: "/path/to/transcript.jsonl",
      cwd: "/test/cwd",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "ls -la",
      },
    };

    // handlePreToolUseをスパイ
    const spy = spyOn(handlers, "handlePreToolUse");
    spy.mockResolvedValue({});

    // Act
    await processHook(input);

    // Assert - PreToolUse専用ハンドラーが呼ばれた
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(input);
  });

  test("PreToolUse以外のhookは空のレスポンスを返す", async () => {
    // Arrange
    const hooks = [
      "PostToolUse",
      "Notification",
      "Stop",
      "SubagentStop",
      "UserPromptSubmit",
      "PreCompact",
    ];

    for (const hookName of hooks) {
      const input = {
        session_id: "test-session",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/test/cwd",
        hook_event_name: hookName,
      } as any;

      // Act
      const result = await processHook(input);

      // Assert
      expect(result).toEqual({});
    }
  });
});