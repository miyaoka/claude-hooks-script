import { describe, expect, it } from "bun:test";
import { checkBashCommand } from "./bash";
import type { BashHookInput, BashRule, HookResponse, PreToolUseDecision } from "./types";

function createBashInput(command: string): BashHookInput {
  return {
    session_id: "test-session",
    transcript_path: "/tmp/transcript.json",
    cwd: "/test/cwd",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command },
  };
}

// 期待する hookSpecificOutput を組み立てるヘルパー（公式フィールドをそのまま渡す）
function res(output: PreToolUseDecision): HookResponse {
  return { hookSpecificOutput: { hookEventName: "PreToolUse", ...output } };
}

describe("checkBashCommand", () => {
  describe("基本動作", () => {
    it("空のルールは空レスポンス", () => {
      expect(checkBashCommand(createBashInput("ls -la"), [])).toEqual({});
    });

    it("ルール非マッチは空レスポンス", () => {
      const rules: BashRule[] = [
        { command: "rm", permissionDecision: "deny", permissionDecisionReason: "rmは禁止" },
      ];
      expect(checkBashCommand(createBashInput("ls -la"), rules)).toEqual({});
    });

    it("command のみで deny", () => {
      const rules: BashRule[] = [
        { command: "rm", permissionDecision: "deny", permissionDecisionReason: "rmは危険" },
      ];
      expect(checkBashCommand(createBashInput("rm -rf /"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "rmは危険" }),
      );
    });

    it("command + args で deny", () => {
      const rules: BashRule[] = [
        {
          command: "git",
          args: "push",
          permissionDecision: "deny",
          permissionDecisionReason: "pushは禁止",
        },
      ];
      expect(checkBashCommand(createBashInput("git push origin main"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "pushは禁止" }),
      );
    });

    it("allow は reason なしでそのまま返す", () => {
      const rules: BashRule[] = [{ command: "ls", permissionDecision: "allow" }];
      expect(checkBashCommand(createBashInput("ls -la"), rules)).toEqual(
        res({ permissionDecision: "allow" }),
      );
    });

    it("allow + reason（ユーザー表示）も素通しする", () => {
      const rules: BashRule[] = [
        { command: "ls", permissionDecision: "allow", permissionDecisionReason: "lsは許可" },
      ];
      expect(checkBashCommand(createBashInput("ls -la"), rules)).toEqual(
        res({ permissionDecision: "allow", permissionDecisionReason: "lsは許可" }),
      );
    });

    it("ask は reason 付きで返す", () => {
      const rules: BashRule[] = [
        {
          command: "psql",
          permissionDecision: "ask",
          permissionDecisionReason: "DB操作は確認",
        },
      ];
      expect(checkBashCommand(createBashInput("psql -c 'drop table'"), rules)).toEqual(
        res({ permissionDecision: "ask", permissionDecisionReason: "DB操作は確認" }),
      );
    });

    it("permissionDecision なしルールは additionalContext 単体", () => {
      const rules: BashRule[] = [{ command: "curl", additionalContext: "外部通信に注意" }];
      expect(checkBashCommand(createBashInput("curl https://example.com"), rules)).toEqual(
        res({ additionalContext: "外部通信に注意" }),
      );
    });

    it("allow + additionalContext を同時に返す", () => {
      const rules: BashRule[] = [
        { command: "psql", permissionDecision: "allow", additionalContext: "本番DBに接続する" },
      ];
      expect(checkBashCommand(createBashInput("psql -h prod"), rules)).toEqual(
        res({ permissionDecision: "allow", additionalContext: "本番DBに接続する" }),
      );
    });

    it("allow + updatedInput でコマンドを差し替える", () => {
      const rules: BashRule[] = [
        {
          command: "npm",
          args: "test",
          permissionDecision: "allow",
          updatedInput: { command: "npm test --silent" },
        },
      ];
      expect(checkBashCommand(createBashInput("npm test"), rules)).toEqual(
        res({ permissionDecision: "allow", updatedInput: { command: "npm test --silent" } }),
      );
    });
  });

  describe("合成（複数マッチ）", () => {
    it("優先順位 deny > defer > ask > allow で採用する", () => {
      const rules: BashRule[] = [
        { command: "echo", args: "safe", permissionDecision: "allow" },
        {
          command: "echo",
          args: "wait",
          permissionDecision: "ask",
          permissionDecisionReason: "確認",
        },
        { command: "echo", args: "later", permissionDecision: "defer" },
        {
          command: "echo",
          args: "danger",
          permissionDecision: "deny",
          permissionDecisionReason: "危険",
        },
      ];

      expect(checkBashCommand(createBashInput("echo safe wait later danger"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "危険" }),
      );
      // defer は ask / allow より優先される
      expect(checkBashCommand(createBashInput("echo safe wait later"), rules)).toEqual(
        res({ permissionDecision: "defer" }),
      );
      expect(checkBashCommand(createBashInput("echo safe wait"), rules)).toEqual(
        res({ permissionDecision: "ask", permissionDecisionReason: "確認" }),
      );
      expect(checkBashCommand(createBashInput("echo safe"), rules)).toEqual(
        res({ permissionDecision: "allow" }),
      );
    });

    it("defer 採用時は additionalContext を付けない（公式上無視される）", () => {
      const rules: BashRule[] = [
        { command: "echo", args: "ctx", additionalContext: "注意" },
        { command: "echo", args: "later", permissionDecision: "defer" },
      ];
      expect(checkBashCommand(createBashInput("echo ctx later"), rules)).toEqual(
        res({ permissionDecision: "defer" }),
      );
    });

    it("additionalContext はマッチした全ルールから集約する", () => {
      const rules: BashRule[] = [
        {
          command: "git",
          args: "push",
          permissionDecision: "deny",
          permissionDecisionReason: "pushは禁止",
          additionalContext: "CIがpushする",
        },
        { command: "rm", additionalContext: "rmは注意" },
      ];
      expect(checkBashCommand(createBashInput("git push origin main; rm tmp"), rules)).toEqual(
        res({
          permissionDecision: "deny",
          permissionDecisionReason: "pushは禁止",
          additionalContext: "CIがpushする\nrmは注意",
        }),
      );
    });

    it("argsありがargsなしより優先", () => {
      const rules: BashRule[] = [
        {
          command: "rm",
          permissionDecision: "deny",
          permissionDecisionReason: "rmはデフォルト禁止",
        },
        { command: "rm", args: "/tmp/", permissionDecision: "allow" },
      ];
      expect(checkBashCommand(createBashInput("rm -rf /tmp/cache"), rules)).toEqual(
        res({ permissionDecision: "allow" }),
      );
    });

    it("同じcommandは後勝ち", () => {
      const rules: BashRule[] = [
        { command: "ls", permissionDecision: "deny", permissionDecisionReason: "最初" },
        { command: "ls", permissionDecision: "allow" },
      ];
      expect(checkBashCommand(createBashInput("ls -la"), rules)).toEqual(
        res({ permissionDecision: "allow" }),
      );
    });

    it("同じcommand/argsは後勝ち", () => {
      const rules: BashRule[] = [
        {
          command: "git",
          args: "push",
          permissionDecision: "deny",
          permissionDecisionReason: "最初",
        },
        {
          command: "git",
          args: "push",
          permissionDecision: "allow",
        },
      ];
      expect(checkBashCommand(createBashInput("git push origin main"), rules)).toEqual(
        res({ permissionDecision: "allow" }),
      );
    });
  });

  describe("argsマッチング", () => {
    it("正規表現マッチ", () => {
      const rules: BashRule[] = [
        {
          command: "rm",
          args: "^/home/",
          permissionDecision: "deny",
          permissionDecisionReason: "ホーム禁止",
        },
        { command: "rm", args: "\\.log$", permissionDecision: "allow" },
      ];

      expect(checkBashCommand(createBashInput("rm /home/user/file.txt"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "ホーム禁止" }),
      );
      expect(checkBashCommand(createBashInput("rm /var/log/app.log"), rules)).toEqual(
        res({ permissionDecision: "allow" }),
      );
    });

    it("部分文字列マッチ（大文字小文字無視）", () => {
      const rules: BashRule[] = [
        {
          command: "echo",
          args: "password",
          permissionDecision: "deny",
          permissionDecisionReason: "パスワード禁止",
        },
      ];
      expect(checkBashCommand(createBashInput("echo My PASSWORD is secret"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "パスワード禁止" }),
      );
    });

    it("無効な正規表現は文字列マッチ", () => {
      const rules: BashRule[] = [
        {
          command: "echo",
          args: "[invalid",
          permissionDecision: "deny",
          permissionDecisionReason: "特殊文字",
        },
      ];
      expect(checkBashCommand(createBashInput("echo [invalid regex"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "特殊文字" }),
      );
    });
  });

  describe("複合コマンド", () => {
    it("&&で連結されたコマンド", () => {
      const rules: BashRule[] = [
        {
          command: "cd",
          args: "/",
          permissionDecision: "deny",
          permissionDecisionReason: "ルート移動禁止",
        },
        { command: "rm", permissionDecision: "deny", permissionDecisionReason: "rm禁止" },
      ];
      expect(checkBashCommand(createBashInput("cd / && rm -rf *"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "ルート移動禁止" }),
      );
    });

    it(";で連結されたコマンド", () => {
      const rules: BashRule[] = [
        { command: "echo", args: "start", permissionDecision: "allow" },
        { command: "rm", permissionDecision: "deny", permissionDecisionReason: "rm禁止" },
      ];
      expect(checkBashCommand(createBashInput("echo start; rm file.txt"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "rm禁止" }),
      );
    });

    it("|でパイプされたコマンド", () => {
      const rules: BashRule[] = [
        {
          command: "cat",
          args: "/etc/passwd",
          permissionDecision: "deny",
          permissionDecisionReason: "機密ファイル禁止",
        },
      ];
      expect(checkBashCommand(createBashInput("cat /etc/passwd | grep root"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "機密ファイル禁止" }),
      );
    });
  });

  describe("ワイルドカードルール", () => {
    const nodeModulesDeny: BashRule = {
      command: "*",
      args: "node_modules",
      permissionDecision: "deny",
      permissionDecisionReason: "node_modules禁止",
    };
    const denied = res({
      permissionDecision: "deny",
      permissionDecisionReason: "node_modules禁止",
    });

    it("生のコマンド文字列全体にマッチする", () => {
      expect(
        checkBashCommand(createBashInput("cat node_modules/foo/index.js"), [nodeModulesDeny]),
      ).toEqual(denied);
    });

    it("変数代入で引数からパターンを消しても捕捉される", () => {
      const evasion =
        'f=/path/to/node_modules/@scope/pkg/dist/index.js; ls "$f" >/dev/null && grep -n "foo" "$f" | head -20';
      expect(checkBashCommand(createBashInput(evasion), [nodeModulesDeny])).toEqual(denied);
    });

    it("パターンを含まないコマンドにはマッチしない", () => {
      expect(checkBashCommand(createBashInput("ls src"), [nodeModulesDeny])).toEqual({});
    });

    it("ワイルドカードdenyがコマンド別allowより優先される", () => {
      const rules: BashRule[] = [{ command: "ls", permissionDecision: "allow" }, nodeModulesDeny];
      expect(checkBashCommand(createBashInput("ls node_modules"), rules)).toEqual(denied);
    });

    it("ワイルドカード非マッチ時はコマンド別ルールが通常通り効く", () => {
      const rules: BashRule[] = [{ command: "ls", permissionDecision: "allow" }, nodeModulesDeny];
      expect(checkBashCommand(createBashInput("ls src"), rules)).toEqual(
        res({ permissionDecision: "allow" }),
      );
    });

    it("同じcommand/argsのワイルドカードは後勝ち", () => {
      const rules: BashRule[] = [
        nodeModulesDeny,
        { command: "*", args: "node_modules", permissionDecision: "allow" },
      ];
      expect(checkBashCommand(createBashInput("ls node_modules"), rules)).toEqual(
        res({ permissionDecision: "allow" }),
      );
    });
  });

  describe("エッジケース", () => {
    it("空のcommand", () => {
      const rules: BashRule[] = [{ command: "ls", permissionDecision: "allow" }];
      expect(checkBashCommand(createBashInput(""), rules)).toEqual({});
    });
  });

  describe("実用シナリオ", () => {
    it("gitコマンドの制御", () => {
      const rules: BashRule[] = [
        {
          command: "git",
          args: "push",
          permissionDecision: "deny",
          permissionDecisionReason: "pushは禁止",
        },
        { command: "git", args: "pull", permissionDecision: "allow" },
        { command: "git", permissionDecision: "allow" },
      ];

      expect(checkBashCommand(createBashInput("git push origin main"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "pushは禁止" }),
      );
      expect(checkBashCommand(createBashInput("git pull origin main"), rules)).toEqual(
        res({ permissionDecision: "allow" }),
      );
      expect(checkBashCommand(createBashInput("git status"), rules)).toEqual(
        res({ permissionDecision: "allow" }),
      );
    });

    it("$(...)に隠したrmもブロックされる", () => {
      const rules: BashRule[] = [
        { command: "rm", permissionDecision: "deny", permissionDecisionReason: "rm禁止" },
      ];
      expect(checkBashCommand(createBashInput("echo $(rm -rf ~)"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "rm禁止" }),
      );
    });

    it("&でバックグラウンド化したrmもブロックされる", () => {
      const rules: BashRule[] = [
        { command: "rm", permissionDecision: "deny", permissionDecisionReason: "rm禁止" },
      ];
      expect(checkBashCommand(createBashInput("sleep 0 & rm -rf ~"), rules)).toEqual(
        res({ permissionDecision: "deny", permissionDecisionReason: "rm禁止" }),
      );
    });

    it("rm -rf ~", () => {
      const result = res({
        permissionDecision: "deny",
        permissionDecisionReason: "ユーザーroot削除禁止",
      });
      const rules: BashRule[] = [
        {
          command: "rm",
          args: "-[rf]{2}\\s+~",
          permissionDecision: "deny",
          permissionDecisionReason: "ユーザーroot削除禁止",
        },
      ];
      expect(checkBashCommand(createBashInput("rm -rf ~"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("rm -fr ~"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("cd ~ && rm -rf ~"), rules)).toEqual(result);
    });
  });
});
