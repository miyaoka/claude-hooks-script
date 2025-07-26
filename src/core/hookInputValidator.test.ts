import { describe, it, expect } from "bun:test";
import { validateHookInput } from "./hookInputValidator";

describe("validateHookInput", () => {
  // 共通の有効なベース入力
  const validBase = {
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/current/working/directory",
  };

  describe("共通フィールドの検証", () => {
    it("有効な共通フィールドを持つ入力を受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
      };
      expect(validateHookInput(input)).toBe(true);
    });

    it("nullを拒否する", () => {
      expect(validateHookInput(null)).toBe(false);
    });

    it("undefinedを拒否する", () => {
      expect(validateHookInput(undefined)).toBe(false);
    });

    it("配列を拒否する", () => {
      expect(validateHookInput([])).toBe(false);
    });

    it("文字列を拒否する", () => {
      expect(validateHookInput("not an object")).toBe(false);
    });

    it("session_idが欠けている場合は拒否する", () => {
      const input = {
        transcript_path: "/path/to/transcript",
        cwd: "/current/working/directory",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
      };
      expect(validateHookInput(input)).toBe(false);
    });

    it("session_idが文字列でない場合は拒否する", () => {
      const input = {
        ...validBase,
        session_id: 123,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
      };
      expect(validateHookInput(input)).toBe(false);
    });

    it("hook_event_nameが欠けている場合は拒否する", () => {
      const input = {
        ...validBase,
        tool_name: "Bash",
        tool_input: {},
      };
      expect(validateHookInput(input)).toBe(false);
    });

    it("未知のhook_event_nameを拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "UnknownHook",
      };
      expect(validateHookInput(input)).toBe(false);
    });
  });

  describe("PreToolUseの検証", () => {
    it("有効なPreToolUse入力を受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls -la" },
      };
      expect(validateHookInput(input)).toBe(true);
    });

    it("tool_nameが欠けている場合は拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "PreToolUse",
        tool_input: { command: "ls" },
      };
      expect(validateHookInput(input)).toBe(false);
    });

    it("tool_inputが欠けている場合は拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
      };
      expect(validateHookInput(input)).toBe(false);
    });

    it("tool_inputがオブジェクトでない場合は拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: "not an object",
      };
      expect(validateHookInput(input)).toBe(false);
    });
  });

  describe("PostToolUseの検証", () => {
    it("有効なPostToolUse入力を受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_response: { output: "file1.txt\nfile2.txt" },
      };
      expect(validateHookInput(input)).toBe(true);
    });

    it("tool_responseがnullでも受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_response: null,
      };
      expect(validateHookInput(input)).toBe(true);
    });

    it("tool_responseが欠けている場合は拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
      };
      expect(validateHookInput(input)).toBe(false);
    });
  });

  describe("Notificationの検証", () => {
    it("有効なNotification入力を受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "Notification",
        message: "This is a notification",
      };
      expect(validateHookInput(input)).toBe(true);
    });

    it("messageが欠けている場合は拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "Notification",
      };
      expect(validateHookInput(input)).toBe(false);
    });

    it("messageが文字列でない場合は拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "Notification",
        message: 123,
      };
      expect(validateHookInput(input)).toBe(false);
    });
  });

  describe("Stopの検証", () => {
    it("有効なStop入力を受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "Stop",
        stop_hook_active: true,
      };
      expect(validateHookInput(input)).toBe(true);
    });

    it("stop_hook_activeがfalseでも受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "Stop",
        stop_hook_active: false,
      };
      expect(validateHookInput(input)).toBe(true);
    });

    it("stop_hook_activeが欠けている場合は拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "Stop",
      };
      expect(validateHookInput(input)).toBe(false);
    });

    it("stop_hook_activeがbooleanでない場合は拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "Stop",
        stop_hook_active: "true",
      };
      expect(validateHookInput(input)).toBe(false);
    });
  });

  describe("SubagentStopの検証", () => {
    it("有効なSubagentStop入力を受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "SubagentStop",
      };
      expect(validateHookInput(input)).toBe(true);
    });

    it("追加フィールドがあっても受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "SubagentStop",
        extra_field: "value",
      };
      expect(validateHookInput(input)).toBe(true);
    });
  });

  describe("UserPromptSubmitの検証", () => {
    it("有効なUserPromptSubmit入力を受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "UserPromptSubmit",
        prompt: "What is the meaning of life?",
      };
      expect(validateHookInput(input)).toBe(true);
    });

    it("promptが欠けている場合は拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "UserPromptSubmit",
      };
      expect(validateHookInput(input)).toBe(false);
    });

    it("promptが文字列でない場合は拒否する", () => {
      const input = {
        ...validBase,
        hook_event_name: "UserPromptSubmit",
        prompt: { text: "not a string" },
      };
      expect(validateHookInput(input)).toBe(false);
    });
  });

  describe("PreCompactの検証", () => {
    it("有効なPreCompact入力を受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "PreCompact",
      };
      expect(validateHookInput(input)).toBe(true);
    });

    it("追加フィールドがあっても受け入れる", () => {
      const input = {
        ...validBase,
        hook_event_name: "PreCompact",
        extra_field: "value",
      };
      expect(validateHookInput(input)).toBe(true);
    });
  });
});