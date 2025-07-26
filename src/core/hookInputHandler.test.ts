import { describe, expect, spyOn, test } from "bun:test";
import * as handlers from "../handlers";
import type { HookInput } from "../types/hook";
import { processHook } from "./hookInputHandler";

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

    try {
      // Act
      await processHook(input);

      // Assert - PreToolUse専用ハンドラーが呼ばれた
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(input, []);
    } finally {
      // スパイをリストア
      spy.mockRestore();
    }
  });

  test("PreToolUse以外のhookは空のレスポンスを返す", async () => {
    // Arrange
    const baseProps = {
      session_id: "test-session",
      transcript_path: "/path/to/transcript.jsonl",
      cwd: "/test/cwd",
    };

    const testCases: HookInput[] = [
      {
        ...baseProps,
        hook_event_name: "PostToolUse",
        tool_name: "TestTool",
        tool_input: {},
        tool_response: {},
      },
      {
        ...baseProps,
        hook_event_name: "Notification",
        message: "test message",
      },
      {
        ...baseProps,
        hook_event_name: "Stop",
        stop_hook_active: false,
      },
      {
        ...baseProps,
        hook_event_name: "SubagentStop",
      },
      {
        ...baseProps,
        hook_event_name: "UserPromptSubmit",
        prompt: "test prompt",
      },
      {
        ...baseProps,
        hook_event_name: "PreCompact",
      },
    ];

    for (const input of testCases) {
      // Act
      const result = await processHook(input);

      // Assert
      expect(result).toEqual({});
    }
  });
});
