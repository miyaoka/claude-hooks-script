import { describe, expect, it } from "bun:test";
import { parseBashCommand } from "./bashParser";

describe("parseBashCommand", () => {
  describe("単一コマンド", () => {
    it("コマンドのみ", () => {
      expect(parseBashCommand("ls")).toEqual([{ command: "ls", args: "" }]);
    });

    it("コマンドと引数", () => {
      expect(parseBashCommand("rm -rf /tmp/test")).toEqual([
        { command: "rm", args: "-rf /tmp/test" },
      ]);
    });

    it("複雑な引数", () => {
      expect(parseBashCommand("grep -E 'pattern.*' file.txt")).toEqual([
        { command: "grep", args: "-E 'pattern.*' file.txt" },
      ]);
    });
  });

  describe("複数コマンド", () => {
    it("&&で連結", () => {
      expect(parseBashCommand("cd /tmp && ls -la")).toEqual([
        { command: "cd", args: "/tmp" },
        { command: "ls", args: "-la" },
      ]);
    });

    it(";で連結", () => {
      expect(parseBashCommand("echo start; rm file.txt; echo done")).toEqual([
        { command: "echo", args: "start" },
        { command: "rm", args: "file.txt" },
        { command: "echo", args: "done" },
      ]);
    });

    it("|でパイプ", () => {
      expect(parseBashCommand("cat file.txt | grep pattern")).toEqual([
        { command: "cat", args: "file.txt" },
        { command: "grep", args: "pattern" },
      ]);
    });

    it("混合した区切り文字", () => {
      expect(parseBashCommand("cd foo && ls -al; rm -rf ~/")).toEqual([
        { command: "cd", args: "foo" },
        { command: "ls", args: "-al" },
        { command: "rm", args: "-rf ~/" },
      ]);
    });

    it("||で連結", () => {
      expect(parseBashCommand("echo a || rm -rf /tmp")).toEqual([
        { command: "echo", args: "a" },
        { command: "rm", args: "-rf /tmp" },
      ]);
    });

    it("&でバックグラウンド実行", () => {
      expect(parseBashCommand("sleep 0 & rm -rf ~")).toEqual([
        { command: "sleep", args: "0" },
        { command: "rm", args: "-rf ~" },
      ]);
    });

    it("redirect構文 >&2 は分離しない", () => {
      expect(parseBashCommand('echo "err" >&2')).toEqual([
        { command: "echo", args: '"err" >&2' },
      ]);
    });

    it("redirect構文 2>&1 は分離しない", () => {
      expect(parseBashCommand("make 2>&1 | tee log")).toEqual([
        { command: "make", args: "2>&1" },
        { command: "tee", args: "log" },
      ]);
    });

    it("&> redirect は分離しない", () => {
      expect(parseBashCommand("cmd &> /dev/null")).toEqual([
        { command: "cmd", args: "&> /dev/null" },
      ]);
    });

    it("&>> redirect は分離しない", () => {
      expect(parseBashCommand("cmd &>> /tmp/log")).toEqual([
        { command: "cmd", args: "&>> /tmp/log" },
      ]);
    });

    it("数字直後の & は redirect ではなく background として分離する", () => {
      expect(parseBashCommand("sleep 0& rm -rf /var")).toEqual([
        { command: "sleep", args: "0" },
        { command: "rm", args: "-rf /var" },
      ]);
    });

    it("末尾数字トークン直後の & も background として分離する", () => {
      expect(parseBashCommand("echo 1 2 3& rm -rf /var")).toEqual([
        { command: "echo", args: "1 2 3" },
        { command: "rm", args: "-rf /var" },
      ]);
    });

    it("数字対数字の N>&N は redirect として保持する", () => {
      expect(parseBashCommand("cmd 1>&2")).toEqual([
        { command: "cmd", args: "1>&2" },
      ]);
    });
  });

  describe("command substitution", () => {
    it("$(...)の中身も独立コマンドとして抽出", () => {
      expect(parseBashCommand("echo $(rm -rf ~)")).toEqual([
        { command: "echo", args: "" },
        { command: "rm", args: "-rf ~" },
      ]);
    });

    it("バッククォートの中身も独立コマンドとして抽出", () => {
      expect(parseBashCommand("echo `rm -rf ~`")).toEqual([
        { command: "echo", args: "" },
        { command: "rm", args: "-rf ~" },
      ]);
    });

    it("$(...)と外側コマンドの両方", () => {
      expect(parseBashCommand("cat $(find /etc -name passwd)")).toEqual([
        { command: "cat", args: "" },
        { command: "find", args: "/etc -name passwd" },
      ]);
    });
  });

  describe("エッジケース", () => {
    it("空文字列", () => {
      expect(parseBashCommand("")).toEqual([]);
    });

    it("スペースのみ", () => {
      expect(parseBashCommand("   ")).toEqual([]);
    });

    it("区切り文字のみ", () => {
      expect(parseBashCommand("&&")).toEqual([]);
      expect(parseBashCommand(";")).toEqual([]);
      expect(parseBashCommand("|")).toEqual([]);
    });

    it("前後の空白", () => {
      expect(parseBashCommand("  rm   -rf   /tmp  ")).toEqual([
        { command: "rm", args: "-rf   /tmp" },
      ]);
    });

    it("クォート内の区切り文字は無視", () => {
      expect(parseBashCommand("echo 'hello && world'")).toEqual([
        { command: "echo", args: "'hello && world'" },
      ]);

      expect(parseBashCommand('echo "hello | world"')).toEqual([
        { command: "echo", args: '"hello | world"' },
      ]);
    });
  });
});
