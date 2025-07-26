import { describe, expect, it } from "bun:test";
import type { BashPreToolUseInput } from "../../types/hook";
import {
  type BashRule,
  handlePreToolUse,
  type PreToolUseRule,
} from "../preToolUse";

// テスト用ヘルパー関数
function createBashInput(command: string): BashPreToolUseInput {
  return {
    session_id: "test-session",
    transcript_path: "/tmp/transcript.json",
    cwd: "/test/cwd",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: {
      command,
    },
  };
}

function createBashRule(rule: Omit<BashRule, "event" | "tool">): BashRule {
  return {
    event: "preToolUse",
    tool: "Bash",
    ...rule,
  };
}

describe("handlePreToolUse - Bash", () => {
  describe("基本動作", () => {
    it("空のルールは空レスポンス", async () => {
      const input = createBashInput("ls -la");
      const response = await handlePreToolUse(input, []);
      expect(response).toEqual({});
    });

    it("ルール非マッチは空レスポンス", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "rm",
          decision: "block",
          reason: "rmは禁止",
        }),
      ];

      const input = createBashInput("ls -la");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({});
    });

    it("commandのみマッチ", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "rm",
          decision: "block",
          reason: "rmコマンドは危険",
        }),
      ];

      const input = createBashInput("rm -rf /");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "rmコマンドは危険",
      });
    });

    it("command + argsマッチ", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "git",
          args: "push",
          decision: "block",
          reason: "pushは禁止",
        }),
      ];

      const input = createBashInput("git push origin main");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "pushは禁止",
      });
    });
  });

  describe("ルール優先順位", () => {
    it("argsありがargsなしより優先", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "rm",
          decision: "block",
          reason: "rmはデフォルト禁止",
        }),
        createBashRule({
          command: "rm",
          args: "/tmp/",
          decision: "approve",
          reason: "/tmpは削除可",
        }),
      ];

      const input = createBashInput("rm -rf /tmp/cache");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "/tmpは削除可",
      });
    });

    it("block > undefined > approveの優先順位", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "echo",
          args: "safe",
          decision: "approve",
          reason: "安全な内容",
        }),
        createBashRule({
          command: "echo",
          args: "warning",
          reason: "警告のみ（decisionなし）",
        }),
        createBashRule({
          command: "echo",
          args: "danger",
          decision: "block",
          reason: "危険な内容",
        }),
      ];

      // 全てマッチ → blockが優先
      const input1 = createBashInput("echo safe warning danger");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "危険な内容",
      });

      // approve + undefined → undefinedが優先
      const input2 = createBashInput("echo safe warning");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        reason: "警告のみ（decisionなし）",
      });

      // approveのみ
      const input3 = createBashInput("echo safe");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "approve",
        reason: "安全な内容",
      });
    });

    it("同じcommandは後勝ち", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "ls",
          decision: "block",
          reason: "最初のルール",
        }),
        createBashRule({
          command: "ls",
          decision: "approve",
          reason: "後のルール",
        }),
      ];

      const input = createBashInput("ls -la");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "後のルール",
      });
    });

    it("同じcommand/argsは後勝ち", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "git",
          args: "push",
          decision: "block",
          reason: "最初のルール",
        }),
        createBashRule({
          command: "git",
          args: "push",
          decision: "approve",
          reason: "後のルール",
        }),
      ];

      const input = createBashInput("git push origin main");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "後のルール",
      });
    });
  });

  describe("argsマッチング", () => {
    it("正規表現マッチ", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "rm",
          args: "^/home/",
          decision: "block",
          reason: "ホームディレクトリ禁止",
        }),
        createBashRule({
          command: "rm",
          args: "\\.log$",
          decision: "approve",
          reason: "ログファイルは削除可",
        }),
      ];

      // /home/で始まる → block
      const input1 = createBashInput("rm /home/user/file.txt");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "ホームディレクトリ禁止",
      });

      // .logで終わる → approve
      const input2 = createBashInput("rm /var/log/app.log");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "approve",
        reason: "ログファイルは削除可",
      });
    });

    it("部分文字列マッチ（大文字小文字無視）", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "echo",
          args: "password",
          decision: "block",
          reason: "パスワード禁止",
        }),
      ];

      const input = createBashInput("echo My PASSWORD is secret");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "パスワード禁止",
      });
    });

    it("無効な正規表現は文字列マッチ", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "echo",
          args: "[invalid",
          decision: "block",
          reason: "特殊文字を含む",
        }),
      ];

      const input = createBashInput("echo [invalid regex");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "特殊文字を含む",
      });
    });
  });

  describe("複合コマンド", () => {
    it("&&で連結されたコマンド", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "cd",
          args: "/",
          decision: "block",
          reason: "ルートへの移動禁止",
        }),
        createBashRule({
          command: "rm",
          decision: "block",
          reason: "rm禁止",
        }),
      ];

      const input = createBashInput("cd / && rm -rf *");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "ルートへの移動禁止",
      });
    });

    it(";で連結されたコマンド", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "echo",
          args: "start",
          decision: "approve",
          reason: "開始OK",
        }),
        createBashRule({
          command: "rm",
          decision: "block",
          reason: "rm禁止",
        }),
      ];

      const input = createBashInput("echo start; rm file.txt");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "rm禁止",
      });
    });

    it("|でパイプされたコマンド", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "cat",
          args: "/etc/passwd",
          decision: "block",
          reason: "機密ファイル禁止",
        }),
      ];

      const input = createBashInput("cat /etc/passwd | grep root");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "機密ファイル禁止",
      });
    });
  });

  describe("エッジケース", () => {
    it("空のcommand", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "ls",
          decision: "approve",
          reason: "lsは許可",
        }),
      ];

      const input = createBashInput("");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({});
    });

    it("Bash以外のツール", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "ls",
          decision: "block",
          reason: "lsは禁止",
        }),
      ];

      const input = {
        ...createBashInput(""),
        tool_name: "WebFetch" as const,
        tool_input: {
          url: "https://example.com",
          prompt: "test",
        },
      };

      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({});
    });
  });

  describe("実用シナリオ", () => {
    it("gitコマンドの制御", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "git",
          args: "push",
          decision: "block",
          reason: "pushは禁止",
        }),
        createBashRule({
          command: "git",
          args: "pull",
          decision: "approve",
          reason: "pullは許可",
        }),
        createBashRule({
          command: "git",
          decision: "approve",
          reason: "その他のgitコマンドは許可",
        }),
      ];

      // push → block
      const input1 = createBashInput("git push origin main");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "pushは禁止",
      });

      // pull → approve
      const input2 = createBashInput("git pull origin main");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "approve",
        reason: "pullは許可",
      });

      // status → デフォルトapprove
      const input3 = createBashInput("git status");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "approve",
        reason: "その他のgitコマンドは許可",
      });
    });

    it("rmコマンドの制御", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "rm",
          decision: "block",
          reason: "rmはデフォルト禁止",
        }),
        createBashRule({
          command: "rm",
          args: "^/tmp/",
          decision: "approve",
          reason: "/tmpは削除可",
        }),
        createBashRule({
          command: "rm",
          args: "^/var/log/.*\\.log$",
          decision: "approve",
          reason: "ログファイルは削除可",
        }),
      ];

      // 一般的なrm → block
      const input1 = createBashInput("rm /home/user/file.txt");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "rmはデフォルト禁止",
      });

      // /tmp → approve
      const input2 = createBashInput("rm /tmp/cache.dat");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "approve",
        reason: "/tmpは削除可",
      });

      // /var/log/*.log → approve
      const input3 = createBashInput("rm /var/log/app.log");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "approve",
        reason: "ログファイルは削除可",
      });
    });

    it("curlコマンドの制御", async () => {
      const rules: PreToolUseRule[] = [
        createBashRule({
          command: "curl",
          decision: "approve",
          reason: "curlはデフォルト許可",
        }),
        createBashRule({
          command: "curl",
          args: "^http://",
          decision: "block",
          reason: "HTTPは禁止",
        }),
        createBashRule({
          command: "curl",
          args: "localhost|127\\.0\\.0\\.1",
          decision: "approve",
          reason: "ローカルは許可",
        }),
      ];

      // HTTPS → デフォルトapprove
      const input1 = createBashInput("curl https://api.example.com");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "approve",
        reason: "curlはデフォルト許可",
      });

      // HTTP → block
      const input2 = createBashInput("curl http://api.example.com");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "block",
        reason: "HTTPは禁止",
      });

      // localhost HTTP → 両方マッチしてblockが優先
      const input3 = createBashInput("curl http://localhost:3000");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "block",
        reason: "HTTPは禁止",
      });
    });
  });
});
