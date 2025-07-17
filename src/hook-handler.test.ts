import { test, expect, describe, spyOn } from "bun:test";
import { processHook } from "./hook-handler";
import * as handlers from "./handlers";
import type { HookInput } from "./types";

describe("hookタイプの判別", () => {
  test("未知のhookタイプはエラーを返す", async () => {
    // Arrange
    const input = {
      session_id: "test-session",
      transcript_path: "/path/to/transcript.jsonl",
      hook_event_name: "UnknownHook",
    } as any;

    // Act & Assert
    await expect(processHook(input)).rejects.toThrow(
      "Unknown hook type: UnknownHook"
    );
  });

  test("PreToolUse hookが正しくルーティングされる", async () => {
    // Arrange
    const input: HookInput = {
      session_id: "test-session",
      transcript_path: "/path/to/transcript.jsonl",
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

  test("PostToolUse hookが正しくルーティングされる", async () => {
    // Arrange
    const input: HookInput = {
      session_id: "test-session",
      transcript_path: "/path/to/transcript.jsonl",
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: {
        file_path: "/tmp/test.txt",
        content: "test content",
      },
      tool_response: {
        success: true,
      },
    };

    // handlePostToolUseをスパイ
    const spy = spyOn(handlers, "handlePostToolUse");
    spy.mockResolvedValue({});

    // Act
    await processHook(input);

    // Assert - PostToolUse専用ハンドラーが呼ばれた
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(input);
  });

  test("Notification hookが正しくルーティングされる", async () => {
    // Arrange
    const input: HookInput = {
      session_id: "test-session",
      transcript_path: "/path/to/transcript.jsonl",
      hook_event_name: "Notification",
      message: "Task completed successfully",
    };

    // handleNotificationをスパイ
    const spy = spyOn(handlers, "handleNotification");
    spy.mockResolvedValue({});

    // Act
    await processHook(input);

    // Assert - Notification専用ハンドラーが呼ばれた
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(input);
  });

  test("Stop hookが正しくルーティングされる", async () => {
    // Arrange
    const input: HookInput = {
      session_id: "test-session",
      transcript_path: "/path/to/transcript.jsonl",
      hook_event_name: "Stop",
      stop_hook_active: true,
    };

    // handleStopをスパイ
    const spy = spyOn(handlers, "handleStop");
    spy.mockResolvedValue({});

    // Act
    await processHook(input);

    // Assert - Stop専用ハンドラーが呼ばれた
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(input);
  });

  test("SubagentStop hookが正しくルーティングされる", async () => {
    // Arrange
    const input: HookInput = {
      session_id: "test-session",
      transcript_path: "/path/to/transcript.jsonl",
      hook_event_name: "SubagentStop",
    };

    // handleSubagentStopをスパイ
    const spy = spyOn(handlers, "handleSubagentStop");
    spy.mockResolvedValue({});

    // Act
    await processHook(input);

    // Assert - SubagentStop専用ハンドラーが呼ばれた
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(input);
  });

  test("PreCompact hookが正しくルーティングされる", async () => {
    // Arrange
    const input: HookInput = {
      session_id: "test-session",
      transcript_path: "/path/to/transcript.jsonl",
      hook_event_name: "PreCompact",
    };

    // handlePreCompactをスパイ
    const spy = spyOn(handlers, "handlePreCompact");
    spy.mockResolvedValue({});

    // Act
    await processHook(input);

    // Assert - PreCompact専用ハンドラーが呼ばれた
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(input);
  });
});
