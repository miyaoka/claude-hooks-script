import { describe, expect, it } from "bun:test";
import { checkBashCommand } from "./bash";
import type { BashHookInput, BashRule, HookResponse } from "./types";

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

// 期待する hookSpecificOutput を組み立てるヘルパー
function deny(reason: string): HookResponse {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

function allow(reason: string): HookResponse {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: reason,
    },
  };
}

function context(reason: string): HookResponse {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: reason,
    },
  };
}

describe("checkBashCommand", () => {
  describe("基本動作", () => {
    it("空のルールは空レスポンス", () => {
      const input = createBashInput("ls -la");
      expect(checkBashCommand(input, [])).toEqual({});
    });

    it("ルール非マッチは空レスポンス", () => {
      const rules: BashRule[] = [{ command: "rm", decision: "deny", reason: "rmは禁止" }];
      expect(checkBashCommand(createBashInput("ls -la"), rules)).toEqual({});
    });

    it("commandのみマッチ", () => {
      const rules: BashRule[] = [{ command: "rm", decision: "deny", reason: "rmコマンドは危険" }];
      expect(checkBashCommand(createBashInput("rm -rf /"), rules)).toEqual(
        deny("rmコマンドは危険"),
      );
    });

    it("command + argsマッチ", () => {
      const rules: BashRule[] = [
        {
          command: "git",
          args: "push",
          decision: "deny",
          reason: "pushは禁止",
        },
      ];
      expect(checkBashCommand(createBashInput("git push origin main"), rules)).toEqual(
        deny("pushは禁止"),
      );
    });

    it("decisionなしルールは additionalContext のみ（ブロックも承認もしない）", () => {
      const rules: BashRule[] = [{ command: "curl", reason: "外部通信に注意" }];
      const result = checkBashCommand(createBashInput("curl https://example.com"), rules);

      expect(result).toEqual(context("外部通信に注意"));
      // permissionDecision を含まない＝通常の許可フローに委譲する契約
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });

  describe("ルール優先順位", () => {
    it("argsありがargsなしより優先", () => {
      const rules: BashRule[] = [
        { command: "rm", decision: "deny", reason: "rmはデフォルト禁止" },
        {
          command: "rm",
          args: "/tmp/",
          decision: "allow",
          reason: "/tmpは削除可",
        },
      ];
      expect(checkBashCommand(createBashInput("rm -rf /tmp/cache"), rules)).toEqual(
        allow("/tmpは削除可"),
      );
    });

    it("deny > undefined > allowの優先順位", () => {
      const rules: BashRule[] = [
        {
          command: "echo",
          args: "safe",
          decision: "allow",
          reason: "安全な内容",
        },
        {
          command: "echo",
          args: "warning",
          reason: "警告のみ（decisionなし）",
        },
        {
          command: "echo",
          args: "danger",
          decision: "deny",
          reason: "危険な内容",
        },
      ];

      expect(checkBashCommand(createBashInput("echo safe warning danger"), rules)).toEqual(
        deny("危険な内容"),
      );

      expect(checkBashCommand(createBashInput("echo safe warning"), rules)).toEqual(
        context("警告のみ（decisionなし）"),
      );

      expect(checkBashCommand(createBashInput("echo safe"), rules)).toEqual(allow("安全な内容"));
    });

    it("同じcommandは後勝ち", () => {
      const rules: BashRule[] = [
        { command: "ls", decision: "deny", reason: "最初のルール" },
        { command: "ls", decision: "allow", reason: "後のルール" },
      ];
      expect(checkBashCommand(createBashInput("ls -la"), rules)).toEqual(allow("後のルール"));
    });

    it("同じcommand/argsは後勝ち", () => {
      const rules: BashRule[] = [
        {
          command: "git",
          args: "push",
          decision: "deny",
          reason: "最初のルール",
        },
        {
          command: "git",
          args: "push",
          decision: "allow",
          reason: "後のルール",
        },
      ];
      expect(checkBashCommand(createBashInput("git push origin main"), rules)).toEqual(
        allow("後のルール"),
      );
    });
  });

  describe("argsマッチング", () => {
    it("正規表現マッチ", () => {
      const rules: BashRule[] = [
        {
          command: "rm",
          args: "^/home/",
          decision: "deny",
          reason: "ホームディレクトリ禁止",
        },
        {
          command: "rm",
          args: "\\.log$",
          decision: "allow",
          reason: "ログファイルは削除可",
        },
      ];

      expect(checkBashCommand(createBashInput("rm /home/user/file.txt"), rules)).toEqual(
        deny("ホームディレクトリ禁止"),
      );

      expect(checkBashCommand(createBashInput("rm /var/log/app.log"), rules)).toEqual(
        allow("ログファイルは削除可"),
      );
    });

    it("部分文字列マッチ（大文字小文字無視）", () => {
      const rules: BashRule[] = [
        {
          command: "echo",
          args: "password",
          decision: "deny",
          reason: "パスワード禁止",
        },
      ];
      expect(checkBashCommand(createBashInput("echo My PASSWORD is secret"), rules)).toEqual(
        deny("パスワード禁止"),
      );
    });

    it("無効な正規表現は文字列マッチ", () => {
      const rules: BashRule[] = [
        {
          command: "echo",
          args: "[invalid",
          decision: "deny",
          reason: "特殊文字を含む",
        },
      ];
      expect(checkBashCommand(createBashInput("echo [invalid regex"), rules)).toEqual(
        deny("特殊文字を含む"),
      );
    });
  });

  describe("複合コマンド", () => {
    it("&&で連結されたコマンド", () => {
      const rules: BashRule[] = [
        {
          command: "cd",
          args: "/",
          decision: "deny",
          reason: "ルートへの移動禁止",
        },
        { command: "rm", decision: "deny", reason: "rm禁止" },
      ];
      expect(checkBashCommand(createBashInput("cd / && rm -rf *"), rules)).toEqual(
        deny("ルートへの移動禁止"),
      );
    });

    it(";で連結されたコマンド", () => {
      const rules: BashRule[] = [
        {
          command: "echo",
          args: "start",
          decision: "allow",
          reason: "開始OK",
        },
        { command: "rm", decision: "deny", reason: "rm禁止" },
      ];
      expect(checkBashCommand(createBashInput("echo start; rm file.txt"), rules)).toEqual(
        deny("rm禁止"),
      );
    });

    it("|でパイプされたコマンド", () => {
      const rules: BashRule[] = [
        {
          command: "cat",
          args: "/etc/passwd",
          decision: "deny",
          reason: "機密ファイル禁止",
        },
      ];
      expect(checkBashCommand(createBashInput("cat /etc/passwd | grep root"), rules)).toEqual(
        deny("機密ファイル禁止"),
      );
    });
  });

  describe("ワイルドカードルール", () => {
    const nodeModulesDeny: BashRule = {
      command: "*",
      args: "node_modules",
      decision: "deny",
      reason: "node_modules禁止",
    };
    const denied = deny("node_modules禁止");

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
      const rules: BashRule[] = [
        { command: "ls", decision: "allow", reason: "lsは許可" },
        nodeModulesDeny,
      ];
      expect(checkBashCommand(createBashInput("ls node_modules"), rules)).toEqual(denied);
    });

    it("ワイルドカード非マッチ時はコマンド別ルールが通常通り効く", () => {
      const rules: BashRule[] = [
        { command: "ls", decision: "allow", reason: "lsは許可" },
        nodeModulesDeny,
      ];
      expect(checkBashCommand(createBashInput("ls src"), rules)).toEqual(allow("lsは許可"));
    });

    it("同じcommand/argsのワイルドカードは後勝ち", () => {
      const rules: BashRule[] = [
        nodeModulesDeny,
        { command: "*", args: "node_modules", decision: "allow", reason: "後のルール" },
      ];
      expect(checkBashCommand(createBashInput("ls node_modules"), rules)).toEqual(
        allow("後のルール"),
      );
    });
  });

  describe("エッジケース", () => {
    it("空のcommand", () => {
      const rules: BashRule[] = [{ command: "ls", decision: "allow", reason: "lsは許可" }];
      expect(checkBashCommand(createBashInput(""), rules)).toEqual({});
    });
  });

  describe("実用シナリオ", () => {
    it("gitコマンドの制御", () => {
      const rules: BashRule[] = [
        {
          command: "git",
          args: "push",
          decision: "deny",
          reason: "pushは禁止",
        },
        {
          command: "git",
          args: "pull",
          decision: "allow",
          reason: "pullは許可",
        },
        {
          command: "git",
          decision: "allow",
          reason: "その他のgitコマンドは許可",
        },
      ];

      expect(checkBashCommand(createBashInput("git push origin main"), rules)).toEqual(
        deny("pushは禁止"),
      );

      expect(checkBashCommand(createBashInput("git pull origin main"), rules)).toEqual(
        allow("pullは許可"),
      );

      expect(checkBashCommand(createBashInput("git status"), rules)).toEqual(
        allow("その他のgitコマンドは許可"),
      );
    });

    it("rmコマンドの制御", () => {
      const rules: BashRule[] = [
        { command: "rm", decision: "deny", reason: "rmはデフォルト禁止" },
        {
          command: "rm",
          args: "^/tmp/",
          decision: "allow",
          reason: "/tmpは削除可",
        },
        {
          command: "rm",
          args: "^/var/log/.*\\.log$",
          decision: "allow",
          reason: "ログファイルは削除可",
        },
      ];

      expect(checkBashCommand(createBashInput("rm /home/user/file.txt"), rules)).toEqual(
        deny("rmはデフォルト禁止"),
      );

      expect(checkBashCommand(createBashInput("rm /tmp/cache.dat"), rules)).toEqual(
        allow("/tmpは削除可"),
      );

      expect(checkBashCommand(createBashInput("rm /var/log/app.log"), rules)).toEqual(
        allow("ログファイルは削除可"),
      );
    });

    it("curlコマンドの制御", () => {
      const rules: BashRule[] = [
        {
          command: "curl",
          decision: "allow",
          reason: "curlはデフォルト許可",
        },
        {
          command: "curl",
          args: "^http://",
          decision: "deny",
          reason: "HTTPは禁止",
        },
        {
          command: "curl",
          args: "localhost|127\\.0\\.0\\.1",
          decision: "allow",
          reason: "ローカルは許可",
        },
      ];

      expect(checkBashCommand(createBashInput("curl https://api.example.com"), rules)).toEqual(
        allow("curlはデフォルト許可"),
      );

      expect(checkBashCommand(createBashInput("curl http://api.example.com"), rules)).toEqual(
        deny("HTTPは禁止"),
      );

      // localhost http → 両方マッチしてdenyが優先
      expect(checkBashCommand(createBashInput("curl http://localhost:3000"), rules)).toEqual(
        deny("HTTPは禁止"),
      );
    });

    it("find / 系のブロック", () => {
      const reason = "ルート直下のfindは禁止";
      const result = deny(reason);
      const rules: BashRule[] = [
        {
          command: "find",
          args: "(?:^|\\s)[\"']?/[\"']?(?:\\s|$)",
          decision: "deny",
          reason,
        },
      ];

      // ブロックされるべきケース
      expect(checkBashCommand(createBashInput("find /"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("find / -path */node_modules*"), rules)).toEqual(
        result,
      );
      expect(checkBashCommand(createBashInput("find -L /"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("find -H -L /"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput('find "/"'), rules)).toEqual(result);

      // 素通しすべきケース（具体パス）
      expect(checkBashCommand(createBashInput("find /Users/me -name foo"), rules)).toEqual({});
      expect(checkBashCommand(createBashInput("find /etc -name passwd"), rules)).toEqual({});
      expect(checkBashCommand(createBashInput("find . -name foo"), rules)).toEqual({});
    });

    it("$(...)に隠したrmもブロックされる", () => {
      const rules: BashRule[] = [{ command: "rm", decision: "deny", reason: "rm禁止" }];
      expect(checkBashCommand(createBashInput("echo $(rm -rf ~)"), rules)).toEqual(deny("rm禁止"));
    });

    it("バッククォートに隠したrmもブロックされる", () => {
      const rules: BashRule[] = [{ command: "rm", decision: "deny", reason: "rm禁止" }];
      expect(checkBashCommand(createBashInput("echo `rm -rf ~`"), rules)).toEqual(deny("rm禁止"));
    });

    it("&でバックグラウンド化したrmもブロックされる", () => {
      const rules: BashRule[] = [{ command: "rm", decision: "deny", reason: "rm禁止" }];
      expect(checkBashCommand(createBashInput("sleep 0 & rm -rf ~"), rules)).toEqual(
        deny("rm禁止"),
      );
    });

    it("rm -rf ~", () => {
      const reason = "ユーザーroot削除禁止";
      const result = deny(reason);
      const rules: BashRule[] = [
        { command: "rm", args: "-[rf]{2}\\s+~", decision: "deny", reason },
      ];
      expect(checkBashCommand(createBashInput("rm -rf ~"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("rm -fr ~"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("rm -rf ~/"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("cd ~ && rm -rf ~"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("rm -rf ~/ && pwd"), rules)).toEqual(result);
    });
  });
});
