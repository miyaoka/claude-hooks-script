import { describe, expect, it } from "bun:test";
import type { PreToolUseInput } from "../types/hook";
import {
  handlePreToolUse,
  normalizeRules,
  type PreToolUseRule,
} from "./preToolUse";

describe("normalizeRules", () => {
  it("同じmatcher, command, argsの組み合わせは後の定義で上書きされる", () => {
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

    const result = normalizeRules(rules);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      matcher: "Bash",
      command: "rm",
      args: "/tmp/",
      decision: "approve",
      reason: "後の定義で上書き",
    });
  });

  it("異なるmatcherは別のルールとして扱われる", () => {
    const rules: PreToolUseRule[] = [
      {
        matcher: "Bash",
        command: "rm",
        args: "/tmp/",
        decision: "block",
        reason: "Bashの場合",
      },
      {
        matcher: "Write",
        command: "rm",
        args: "/tmp/",
        decision: "approve",
        reason: "Writeの場合",
      },
    ];

    const result = normalizeRules(rules);
    expect(result).toHaveLength(2);
  });

  it("異なるcommandは別のルールとして扱われる", () => {
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

    const result = normalizeRules(rules);
    expect(result).toHaveLength(2);
  });

  it("異なるargsは別のルールとして扱われる", () => {
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

    const result = normalizeRules(rules);
    expect(result).toHaveLength(2);
  });

  it("undefinedのフィールドは空文字として扱われる", () => {
    const rules: PreToolUseRule[] = [
      {
        reason: "matcher, command, argsすべて省略",
      },
      {
        reason: "同じく省略（上書き）",
      },
    ];

    const result = normalizeRules(rules);
    expect(result).toHaveLength(1);
    expect(result[0]?.reason).toBe("同じく省略（上書き）");
  });

  it("複雑な組み合わせでも正しく動作する", () => {
    const rules: PreToolUseRule[] = [
      // 1つ目のグループ（後で上書きされる）
      {
        matcher: "Bash",
        command: "git",
        args: "push",
        decision: "block",
        reason: "初期設定",
      },
      // 2つ目のグループ（残る）
      {
        matcher: "Write",
        args: "/etc/",
        decision: "block",
        reason: "システムファイル",
      },
      // 1つ目のグループを上書き
      {
        matcher: "Bash",
        command: "git",
        args: "push",
        decision: "approve",
        reason: "上書き後",
      },
      // 3つ目のグループ（残る）
      {
        command: "rm",
        decision: "block",
        reason: "すべてのツールでrmをブロック",
      },
    ];

    const result = normalizeRules(rules);
    expect(result).toHaveLength(3);

    // 順序は保証されないので、各ルールの存在を確認
    const bashGitPush = result.find(
      (r) => r.matcher === "Bash" && r.command === "git" && r.args === "push",
    );
    expect(bashGitPush).toEqual({
      matcher: "Bash",
      command: "git",
      args: "push",
      decision: "approve",
      reason: "上書き後",
    });

    const writeEtc = result.find(
      (r) => r.matcher === "Write" && r.args === "/etc/",
    );
    expect(writeEtc).toBeDefined();

    const rm = result.find((r) => r.command === "rm" && !r.matcher);
    expect(rm).toBeDefined();
  });
});

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
    it("ツール名がマッチしない場合は空のオブジェクトを返す", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Write",
          decision: "block",
          reason: "Writeツールは禁止",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Read",
        tool_input: {
          file_path: "/etc/passwd",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({});
    });

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

  describe("Bash以外のツール", () => {
    it("Writeツールでargsパターンマッチ", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Write",
          args: "/etc/",
          decision: "block",
          reason: "システムファイルへの書き込みは禁止",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/etc/passwd",
          content: "malicious content",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "システムファイルへの書き込みは禁止",
      });
    });

    it("Edit|Write|MultiEditの正規表現マッチャー", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Edit|Write|MultiEdit",
          args: ".*\\.env",
          decision: "block",
          reason: "環境変数ファイルの編集は禁止",
        },
      ];

      // Editツール
      const inputEdit: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/app/.env",
          old_str: "SECRET=old",
          new_str: "SECRET=new",
        },
      };

      const responseEdit = await handlePreToolUse(inputEdit, rules);
      expect(responseEdit).toEqual({
        decision: "block",
        reason: "環境変数ファイルの編集は禁止",
      });

      // MultiEditツール
      const inputMultiEdit: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "MultiEdit",
        tool_input: {
          file_path: "/app/.env",
          edits: [],
        },
      };

      const responseMultiEdit = await handlePreToolUse(inputMultiEdit, rules);
      expect(responseMultiEdit).toEqual({
        decision: "block",
        reason: "環境変数ファイルの編集は禁止",
      });
    });

    it("すべてのツールにマッチする空のmatcher", async () => {
      const rules: PreToolUseRule[] = [
        {
          // matcherを省略
          args: "secret",
          decision: "block",
          reason: "secretを含むパスは禁止",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Read",
        tool_input: {
          file_path: "/app/secret.key",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "secretを含むパスは禁止",
      });
    });

    it("Bash以外のツールでcommandフィールドは無視される", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Write",
          command: "rm", // Bash以外では無視される
          args: "/tmp/",
          decision: "approve",
          reason: "一時ディレクトリへの書き込みは許可",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/tmp/test.txt",
          content: "test",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "一時ディレクトリへの書き込みは許可",
      });
    });
  });

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
        tool_input: {},
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

    it("Bash以外のツールで無効な正規表現のargsは文字列として比較される", async () => {
      const rules: PreToolUseRule[] = [
        {
          matcher: "Write",
          args: "[invalid regex", // 無効な正規表現
          decision: "block",
          reason: "Invalid regex in Write",
        },
      ];

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.json",
        cwd: "/test/cwd",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/tmp/[invalid regex.txt",
          content: "test",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "Invalid regex in Write",
      });
    });
  });
});
