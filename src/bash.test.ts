import { describe, expect, it } from "bun:test";
import { checkBashCommand } from "./bash";
import type { BashHookInput, BashRule } from "./types";

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

describe("checkBashCommand", () => {
  describe("基本動作", () => {
    it("空のルールは空レスポンス", () => {
      const input = createBashInput("ls -la");
      expect(checkBashCommand(input, [])).toEqual({});
    });

    it("ルール非マッチは空レスポンス", () => {
      const rules: BashRule[] = [{ command: "rm", decision: "block", reason: "rmは禁止" }];
      expect(checkBashCommand(createBashInput("ls -la"), rules)).toEqual({});
    });

    it("commandのみマッチ", () => {
      const rules: BashRule[] = [{ command: "rm", decision: "block", reason: "rmコマンドは危険" }];
      expect(checkBashCommand(createBashInput("rm -rf /"), rules)).toEqual({
        decision: "block",
        reason: "rmコマンドは危険",
      });
    });

    it("command + argsマッチ", () => {
      const rules: BashRule[] = [
        {
          command: "git",
          args: "push",
          decision: "block",
          reason: "pushは禁止",
        },
      ];
      expect(checkBashCommand(createBashInput("git push origin main"), rules)).toEqual({
        decision: "block",
        reason: "pushは禁止",
      });
    });
  });

  describe("ルール優先順位", () => {
    it("argsありがargsなしより優先", () => {
      const rules: BashRule[] = [
        { command: "rm", decision: "block", reason: "rmはデフォルト禁止" },
        {
          command: "rm",
          args: "/tmp/",
          decision: "approve",
          reason: "/tmpは削除可",
        },
      ];
      expect(checkBashCommand(createBashInput("rm -rf /tmp/cache"), rules)).toEqual({
        decision: "approve",
        reason: "/tmpは削除可",
      });
    });

    it("block > undefined > approveの優先順位", () => {
      const rules: BashRule[] = [
        {
          command: "echo",
          args: "safe",
          decision: "approve",
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
          decision: "block",
          reason: "危険な内容",
        },
      ];

      expect(checkBashCommand(createBashInput("echo safe warning danger"), rules)).toEqual({
        decision: "block",
        reason: "危険な内容",
      });

      expect(checkBashCommand(createBashInput("echo safe warning"), rules)).toEqual({
        reason: "警告のみ（decisionなし）",
      });

      expect(checkBashCommand(createBashInput("echo safe"), rules)).toEqual({
        decision: "approve",
        reason: "安全な内容",
      });
    });

    it("同じcommandは後勝ち", () => {
      const rules: BashRule[] = [
        { command: "ls", decision: "block", reason: "最初のルール" },
        { command: "ls", decision: "approve", reason: "後のルール" },
      ];
      expect(checkBashCommand(createBashInput("ls -la"), rules)).toEqual({
        decision: "approve",
        reason: "後のルール",
      });
    });

    it("同じcommand/argsは後勝ち", () => {
      const rules: BashRule[] = [
        {
          command: "git",
          args: "push",
          decision: "block",
          reason: "最初のルール",
        },
        {
          command: "git",
          args: "push",
          decision: "approve",
          reason: "後のルール",
        },
      ];
      expect(checkBashCommand(createBashInput("git push origin main"), rules)).toEqual({
        decision: "approve",
        reason: "後のルール",
      });
    });
  });

  describe("argsマッチング", () => {
    it("正規表現マッチ", () => {
      const rules: BashRule[] = [
        {
          command: "rm",
          args: "^/home/",
          decision: "block",
          reason: "ホームディレクトリ禁止",
        },
        {
          command: "rm",
          args: "\\.log$",
          decision: "approve",
          reason: "ログファイルは削除可",
        },
      ];

      expect(checkBashCommand(createBashInput("rm /home/user/file.txt"), rules)).toEqual({
        decision: "block",
        reason: "ホームディレクトリ禁止",
      });

      expect(checkBashCommand(createBashInput("rm /var/log/app.log"), rules)).toEqual({
        decision: "approve",
        reason: "ログファイルは削除可",
      });
    });

    it("部分文字列マッチ（大文字小文字無視）", () => {
      const rules: BashRule[] = [
        {
          command: "echo",
          args: "password",
          decision: "block",
          reason: "パスワード禁止",
        },
      ];
      expect(checkBashCommand(createBashInput("echo My PASSWORD is secret"), rules)).toEqual({
        decision: "block",
        reason: "パスワード禁止",
      });
    });

    it("無効な正規表現は文字列マッチ", () => {
      const rules: BashRule[] = [
        {
          command: "echo",
          args: "[invalid",
          decision: "block",
          reason: "特殊文字を含む",
        },
      ];
      expect(checkBashCommand(createBashInput("echo [invalid regex"), rules)).toEqual({
        decision: "block",
        reason: "特殊文字を含む",
      });
    });
  });

  describe("複合コマンド", () => {
    it("&&で連結されたコマンド", () => {
      const rules: BashRule[] = [
        {
          command: "cd",
          args: "/",
          decision: "block",
          reason: "ルートへの移動禁止",
        },
        { command: "rm", decision: "block", reason: "rm禁止" },
      ];
      expect(checkBashCommand(createBashInput("cd / && rm -rf *"), rules)).toEqual({
        decision: "block",
        reason: "ルートへの移動禁止",
      });
    });

    it(";で連結されたコマンド", () => {
      const rules: BashRule[] = [
        {
          command: "echo",
          args: "start",
          decision: "approve",
          reason: "開始OK",
        },
        { command: "rm", decision: "block", reason: "rm禁止" },
      ];
      expect(checkBashCommand(createBashInput("echo start; rm file.txt"), rules)).toEqual({
        decision: "block",
        reason: "rm禁止",
      });
    });

    it("|でパイプされたコマンド", () => {
      const rules: BashRule[] = [
        {
          command: "cat",
          args: "/etc/passwd",
          decision: "block",
          reason: "機密ファイル禁止",
        },
      ];
      expect(checkBashCommand(createBashInput("cat /etc/passwd | grep root"), rules)).toEqual({
        decision: "block",
        reason: "機密ファイル禁止",
      });
    });
  });

  describe("ワイルドカードルール", () => {
    const nodeModulesBlock: BashRule = {
      command: "*",
      args: "node_modules",
      decision: "block",
      reason: "node_modules禁止",
    };
    const blocked = { decision: "block", reason: "node_modules禁止" } as const;

    it("生のコマンド文字列全体にマッチする", () => {
      expect(
        checkBashCommand(createBashInput("cat node_modules/foo/index.js"), [nodeModulesBlock]),
      ).toEqual(blocked);
    });

    it("変数代入で引数からパターンを消しても捕捉される", () => {
      const evasion =
        'f=/path/to/node_modules/@scope/pkg/dist/index.js; ls "$f" >/dev/null && grep -n "foo" "$f" | head -20';
      expect(checkBashCommand(createBashInput(evasion), [nodeModulesBlock])).toEqual(blocked);
    });

    it("パターンを含まないコマンドにはマッチしない", () => {
      expect(checkBashCommand(createBashInput("ls src"), [nodeModulesBlock])).toEqual({});
    });

    it("ワイルドカードblockがコマンド別approveより優先される", () => {
      const rules: BashRule[] = [
        { command: "ls", decision: "approve", reason: "lsは許可" },
        nodeModulesBlock,
      ];
      expect(checkBashCommand(createBashInput("ls node_modules"), rules)).toEqual(blocked);
    });

    it("ワイルドカード非マッチ時はコマンド別ルールが通常通り効く", () => {
      const rules: BashRule[] = [
        { command: "ls", decision: "approve", reason: "lsは許可" },
        nodeModulesBlock,
      ];
      expect(checkBashCommand(createBashInput("ls src"), rules)).toEqual({
        decision: "approve",
        reason: "lsは許可",
      });
    });

    it("同じcommand/argsのワイルドカードは後勝ち", () => {
      const rules: BashRule[] = [
        nodeModulesBlock,
        { command: "*", args: "node_modules", decision: "approve", reason: "後のルール" },
      ];
      expect(checkBashCommand(createBashInput("ls node_modules"), rules)).toEqual({
        decision: "approve",
        reason: "後のルール",
      });
    });
  });

  describe("エッジケース", () => {
    it("空のcommand", () => {
      const rules: BashRule[] = [{ command: "ls", decision: "approve", reason: "lsは許可" }];
      expect(checkBashCommand(createBashInput(""), rules)).toEqual({});
    });
  });

  describe("実用シナリオ", () => {
    it("gitコマンドの制御", () => {
      const rules: BashRule[] = [
        {
          command: "git",
          args: "push",
          decision: "block",
          reason: "pushは禁止",
        },
        {
          command: "git",
          args: "pull",
          decision: "approve",
          reason: "pullは許可",
        },
        {
          command: "git",
          decision: "approve",
          reason: "その他のgitコマンドは許可",
        },
      ];

      expect(checkBashCommand(createBashInput("git push origin main"), rules)).toEqual({
        decision: "block",
        reason: "pushは禁止",
      });

      expect(checkBashCommand(createBashInput("git pull origin main"), rules)).toEqual({
        decision: "approve",
        reason: "pullは許可",
      });

      expect(checkBashCommand(createBashInput("git status"), rules)).toEqual({
        decision: "approve",
        reason: "その他のgitコマンドは許可",
      });
    });

    it("rmコマンドの制御", () => {
      const rules: BashRule[] = [
        { command: "rm", decision: "block", reason: "rmはデフォルト禁止" },
        {
          command: "rm",
          args: "^/tmp/",
          decision: "approve",
          reason: "/tmpは削除可",
        },
        {
          command: "rm",
          args: "^/var/log/.*\\.log$",
          decision: "approve",
          reason: "ログファイルは削除可",
        },
      ];

      expect(checkBashCommand(createBashInput("rm /home/user/file.txt"), rules)).toEqual({
        decision: "block",
        reason: "rmはデフォルト禁止",
      });

      expect(checkBashCommand(createBashInput("rm /tmp/cache.dat"), rules)).toEqual({
        decision: "approve",
        reason: "/tmpは削除可",
      });

      expect(checkBashCommand(createBashInput("rm /var/log/app.log"), rules)).toEqual({
        decision: "approve",
        reason: "ログファイルは削除可",
      });
    });

    it("curlコマンドの制御", () => {
      const rules: BashRule[] = [
        {
          command: "curl",
          decision: "approve",
          reason: "curlはデフォルト許可",
        },
        {
          command: "curl",
          args: "^http://",
          decision: "block",
          reason: "HTTPは禁止",
        },
        {
          command: "curl",
          args: "localhost|127\\.0\\.0\\.1",
          decision: "approve",
          reason: "ローカルは許可",
        },
      ];

      expect(checkBashCommand(createBashInput("curl https://api.example.com"), rules)).toEqual({
        decision: "approve",
        reason: "curlはデフォルト許可",
      });

      expect(checkBashCommand(createBashInput("curl http://api.example.com"), rules)).toEqual({
        decision: "block",
        reason: "HTTPは禁止",
      });

      // localhost http → 両方マッチしてblockが優先
      expect(checkBashCommand(createBashInput("curl http://localhost:3000"), rules)).toEqual({
        decision: "block",
        reason: "HTTPは禁止",
      });
    });

    it("find / 系のブロック", () => {
      const result = {
        decision: "block",
        reason: "ルート直下のfindは禁止",
      } as const;
      const rules: BashRule[] = [
        {
          command: "find",
          args: "(?:^|\\s)[\"']?/[\"']?(?:\\s|$)",
          ...result,
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
      const rules: BashRule[] = [{ command: "rm", decision: "block", reason: "rm禁止" }];
      expect(checkBashCommand(createBashInput("echo $(rm -rf ~)"), rules)).toEqual({
        decision: "block",
        reason: "rm禁止",
      });
    });

    it("バッククォートに隠したrmもブロックされる", () => {
      const rules: BashRule[] = [{ command: "rm", decision: "block", reason: "rm禁止" }];
      expect(checkBashCommand(createBashInput("echo `rm -rf ~`"), rules)).toEqual({
        decision: "block",
        reason: "rm禁止",
      });
    });

    it("&でバックグラウンド化したrmもブロックされる", () => {
      const rules: BashRule[] = [{ command: "rm", decision: "block", reason: "rm禁止" }];
      expect(checkBashCommand(createBashInput("sleep 0 & rm -rf ~"), rules)).toEqual({
        decision: "block",
        reason: "rm禁止",
      });
    });

    it("rm -rf ~", () => {
      const result = {
        decision: "block",
        reason: "ユーザーroot削除禁止",
      } as const;
      const rules: BashRule[] = [{ command: "rm", args: "-[rf]{2}\\s+~", ...result }];
      expect(checkBashCommand(createBashInput("rm -rf ~"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("rm -fr ~"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("rm -rf ~/"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("cd ~ && rm -rf ~"), rules)).toEqual(result);
      expect(checkBashCommand(createBashInput("rm -rf ~/ && pwd"), rules)).toEqual(result);
    });
  });
});
