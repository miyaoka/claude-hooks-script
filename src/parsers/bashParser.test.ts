import { describe, it, expect } from "bun:test";
import { parseBashCommand } from "./bashParser";

describe("parseBashCommand", () => {
  describe("単一コマンド", () => {
    it("コマンドのみ", () => {
      expect(parseBashCommand("ls")).toEqual([
        { command: "ls", args: "" }
      ]);
    });

    it("コマンドと引数", () => {
      expect(parseBashCommand("rm -rf /tmp/test")).toEqual([
        { command: "rm", args: "-rf /tmp/test" }
      ]);
    });

    it("複雑な引数", () => {
      expect(parseBashCommand("grep -E 'pattern.*' file.txt")).toEqual([
        { command: "grep", args: "-E 'pattern.*' file.txt" }
      ]);
    });
  });

  describe("複数コマンド", () => {
    it("&&で連結", () => {
      expect(parseBashCommand("cd /tmp && ls -la")).toEqual([
        { command: "cd", args: "/tmp" },
        { command: "ls", args: "-la" }
      ]);
    });

    it(";で連結", () => {
      expect(parseBashCommand("echo start; rm file.txt; echo done")).toEqual([
        { command: "echo", args: "start" },
        { command: "rm", args: "file.txt" },
        { command: "echo", args: "done" }
      ]);
    });

    it("|でパイプ", () => {
      expect(parseBashCommand("cat file.txt | grep pattern")).toEqual([
        { command: "cat", args: "file.txt" },
        { command: "grep", args: "pattern" }
      ]);
    });

    it("混合した区切り文字", () => {
      expect(parseBashCommand("cd foo && ls -al; rm -rf ~/")).toEqual([
        { command: "cd", args: "foo" },
        { command: "ls", args: "-al" },
        { command: "rm", args: "-rf ~/" }
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
        { command: "rm", args: "-rf   /tmp" }
      ]);
    });

    it("クォート内の区切り文字は無視", () => {
      expect(parseBashCommand("echo 'hello && world'")).toEqual([
        { command: "echo", args: "'hello && world'" }
      ]);
      
      expect(parseBashCommand('echo "hello | world"')).toEqual([
        { command: "echo", args: '"hello | world"' }
      ]);
    });
  });
});