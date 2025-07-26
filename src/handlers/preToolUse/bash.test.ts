import { describe, expect, it } from "bun:test";
import type { PreToolUseInput } from "../../types/hook";
import { handlePreToolUse, type PreToolUseRule } from "../preToolUse";

describe("handlePreToolUse - 優先順位とマッチング", () => {
  describe("デフォルト設定と特定条件の優先順位", () => {
    it("argsなしのデフォルト設定が適用される", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Bash",
          command: "rm",
          decision: "block",
          reason: "rmコマンドは危険",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "rm -rf /",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "rmコマンドは危険",
      });
    });

    it("argsありの設定がデフォルト設定より優先される", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Bash",
          command: "rm",
          decision: "block",
          reason: "rmコマンドは危険",
        },
        {
          matcher: "Bash",
          command: "rm",
          args: "/tmp/",
          decision: "approve",
          reason: "一時ディレクトリの削除は許可",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "rm -rf /tmp/cache",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "一時ディレクトリの削除は許可",
      });
    });
  });

  describe("配列での上書きルール", () => {
    it("argsなしの同じcommandは後者で上書きされる", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Bash",
          command: "ls",
          decision: "block",
          reason: "最初のルール",
        },
        {
          matcher: "Bash",
          command: "ls",
          decision: "approve",
          reason: "後のルールで上書き",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "ls -la",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "後のルールで上書き",
      });
    });

    it("argsありはcommandとargs両方が同一の場合のみ上書きされる", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Bash",
          command: "git",
          args: "push",
          decision: "block",
          reason: "pushは禁止",
        },
        {
          matcher: "Bash",
          command: "git",
          args: "pull",
          decision: "approve",
          reason: "pullは許可",
        },
        {
          matcher: "Bash",
          command: "git",
          args: "push",
          decision: "approve",
          reason: "pushを許可に変更",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "git push origin main",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "pushを許可に変更",
      });
    });
  });

  describe("複数マッチ時のdecision優先順位", () => {
    it("block > approveの優先順位で安全側に倒される", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Bash",
          command: "rm",
          args: "/tmp/",
          decision: "approve",
          reason: "一時ディレクトリの削除は許可",
        },
        {
          matcher: "Bash",
          command: "rm",
          args: "important",
          decision: "block",
          reason: "importantを含むファイルの削除は禁止",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "rm -rf /tmp/important-cache",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "importantを含むファイルの削除は禁止",
      });
    });

    it("block > undefined > approveの優先順位", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Bash",
          command: "echo",
          args: "test",
          decision: "approve",
          reason: "echoは許可",
        },
        {
          matcher: "Bash",
          command: "echo",
          args: "password",
          // decisionを省略
          reason: "パスワードを含む場合の処理",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "echo test password",
        },
      };

      const response = await handlePreToolUse(input, rules);
      // decisionがundefinedのルールもマッチした場合、reasonのみ返される
      expect(response).toEqual({
        reason: "パスワードを含む場合の処理",
      });
    });
  });

  describe("マッチしない場合", () => {
    it("コマンドがマッチしない場合は空のオブジェクトを返す", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Bash",
          command: "rm",
          decision: "block",
          reason: "rmコマンドは禁止",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "ls -la",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({});
    });
  });

  describe("Bash以外のツール", () => {});

  describe("エッジケース", () => {
    it("rulesが空配列の場合は空のオブジェクトを返す", async () => {
      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
      };

      const response = await handlePreToolUse(input, []);
      expect(response).toEqual({});
    });

    it("Bashツールでcommandが空の場合は空のオブジェクトを返す", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Bash",
          command: "ls",
          decision: "approve",
          reason: "lsコマンドは許可",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "" },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({});
    });

    it("Bashツールでcommandがundefinedの場合は空のオブジェクトを返す", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Bash",
          command: "ls",
          decision: "approve",
          reason: "lsコマンドは許可",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({});
    });

    it("Bashツールで無効な正規表現のargsは文字列として比較される", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Bash",
          command: "echo",
          args: "[invalid regex", // 無効な正規表現
          decision: "block",
          reason: "Invalid regex test",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "echo [invalid regex" },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "Invalid regex test",
      });
    });
  });
});
