import { describe, it, expect } from "bun:test";
import { matchTool } from "./matcher";

describe("matchTool", () => {
  describe("基本的なマッチング", () => {
    it("完全一致", () => {
      expect(matchTool("Bash", "Bash")).toBe(true);
      expect(matchTool("Read", "Read")).toBe(true);
      expect(matchTool("Write", "Read")).toBe(false);
    });

    it("大文字小文字を区別する", () => {
      expect(matchTool("bash", "Bash")).toBe(false);
      expect(matchTool("BASH", "Bash")).toBe(false);
    });

    it("空文字列または省略はすべてにマッチ", () => {
      expect(matchTool("", "Bash")).toBe(true);
      expect(matchTool("", "Read")).toBe(true);
      expect(matchTool("", "AnyTool")).toBe(true);
      expect(matchTool(undefined, "Bash")).toBe(true);
    });
  });

  describe("正規表現パターン", () => {
    it("OR条件", () => {
      const pattern = "Edit|Write";
      expect(matchTool(pattern, "Edit")).toBe(true);
      expect(matchTool(pattern, "Write")).toBe(true);
      expect(matchTool(pattern, "Read")).toBe(false);
    });

    it("ワイルドカードパターン", () => {
      const pattern = "Notebook.*";
      expect(matchTool(pattern, "NotebookRead")).toBe(true);
      expect(matchTool(pattern, "NotebookEdit")).toBe(true);
      expect(matchTool(pattern, "Notebook")).toBe(true);
      expect(matchTool(pattern, "Read")).toBe(false);
    });

    it("複雑なパターン", () => {
      const pattern = "(Edit|Write|MultiEdit)";
      expect(matchTool(pattern, "Edit")).toBe(true);
      expect(matchTool(pattern, "Write")).toBe(true);
      expect(matchTool(pattern, "MultiEdit")).toBe(true);
      expect(matchTool(pattern, "Read")).toBe(false);
    });
  });

  describe("エッジケース", () => {
    it("無効な正規表現はエラーにならず、文字列として比較", () => {
      const pattern = "[invalid";
      expect(matchTool(pattern, "[invalid")).toBe(true);
      expect(matchTool(pattern, "Edit")).toBe(false);
    });

    it("undefinedの扱い", () => {
      expect(matchTool(undefined, "Bash")).toBe(true);
    });
  });
});