import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { validateConfig } from "./config";

describe("validateConfig", () => {
  let errorMock: ReturnType<typeof mock>;
  let originalError: typeof console.error;

  beforeEach(() => {
    errorMock = mock(() => {});
    originalError = console.error;
    console.error = errorMock as unknown as typeof console.error;
  });

  afterEach(() => {
    console.error = originalError;
  });

  describe("正常系", () => {
    it("最小ルール (command, reason)", () => {
      expect(validateConfig([{ command: "ls", reason: "lsは許可" }])).toBe(
        true,
      );
    });

    it("全フィールド指定 (block)", () => {
      expect(
        validateConfig([
          {
            command: "rm",
            args: "-rf",
            decision: "block",
            reason: "危険",
          },
        ]),
      ).toBe(true);
    });

    it("decision: approve も受け付ける", () => {
      expect(
        validateConfig([
          { command: "ls", decision: "approve", reason: "安全" },
        ]),
      ).toBe(true);
    });

    it("空配列", () => {
      expect(validateConfig([])).toBe(true);
    });

    it("複数ルール", () => {
      expect(
        validateConfig([
          { command: "ls", reason: "a" },
          { command: "rm", args: "x", decision: "block", reason: "b" },
        ]),
      ).toBe(true);
    });
  });

  describe("配列構造エラー", () => {
    it("非配列を拒否", () => {
      expect(validateConfig({})).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        "Config validation error: Config must be an array",
      );
    });

    it("null を拒否", () => {
      expect(validateConfig(null)).toBe(false);
    });

    it("文字列を拒否", () => {
      expect(validateConfig("not array")).toBe(false);
    });
  });

  describe("ルール構造エラー", () => {
    it("配列内 null を拒否", () => {
      expect(validateConfig([null])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("rule must be a plain object"),
        null,
      );
    });

    it("配列内が array のルールを拒否", () => {
      expect(validateConfig([[]])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("rule must be a plain object"),
        [],
      );
    });

    it("command 欠落を拒否", () => {
      expect(validateConfig([{ reason: "no command" }])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("command must be a string"),
        { reason: "no command" },
      );
    });

    it("command が非 string を拒否", () => {
      expect(validateConfig([{ command: 123, reason: "x" }])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("command must be a string"),
        { command: 123, reason: "x" },
      );
    });

    it("reason 欠落を拒否", () => {
      expect(validateConfig([{ command: "ls" }])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("reason must be a string"),
        { command: "ls" },
      );
    });

    it("args が非 string を拒否", () => {
      expect(validateConfig([{ command: "ls", args: 123, reason: "x" }])).toBe(
        false,
      );
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("args must be a string when present"),
        { command: "ls", args: 123, reason: "x" },
      );
    });

    it("decision が無効値を拒否", () => {
      expect(
        validateConfig([{ command: "ls", decision: "warn", reason: "x" }]),
      ).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining(
          'decision must be "block" or "approve" when present',
        ),
        { command: "ls", decision: "warn", reason: "x" },
      );
    });

    it("空オブジェクト {} を拒否", () => {
      expect(validateConfig([{}])).toBe(false);
    });
  });

  describe("旧スキーマ検出 (未知フィールド)", () => {
    it("v0 WebFetch ルール (event/tool/domain) を拒否し旧スキーマ誘導文を出す", () => {
      const oldRule = {
        event: "preToolUse",
        tool: "WebFetch",
        domain: "example.com",
        decision: "block",
        reason: "block fetch",
      };
      expect(validateConfig([oldRule])).toBe(false);
      // command が無いので最初に command エラーが先に出る
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("command must be a string"),
        oldRule,
      );
    });

    it("v0 Bash ルール (event/tool 付き) を未知フィールドエラーで拒否", () => {
      const oldRule = {
        event: "preToolUse",
        tool: "Bash",
        command: "rm",
        reason: "block rm",
      };
      expect(validateConfig([oldRule])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "unknown fields: event, tool — may be using old schema; remove event/tool/domain/query",
        ),
        oldRule,
      );
    });

    it("単一の未知フィールドも拒否", () => {
      expect(
        validateConfig([{ command: "ls", reason: "x", note: "メモ" }]),
      ).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("unknown fields: note"),
        { command: "ls", reason: "x", note: "メモ" },
      );
    });

    it("複数の未知フィールドをカンマ区切りで列挙", () => {
      const rule = {
        command: "ls",
        reason: "x",
        event: "preToolUse",
        tool: "Bash",
        domain: "example.com",
      };
      expect(validateConfig([rule])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("unknown fields: event, tool, domain"),
        rule,
      );
    });
  });

  describe("インデックス付きエラー出力", () => {
    it("複数ルールで invalid なものだけ index 付きでエラーを出す", () => {
      expect(
        validateConfig([
          { command: "ls", reason: "ok" },
          { command: "rm" }, // reason 欠落
          { command: "cat", reason: "ok" },
        ]),
      ).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringMatching(/^Config validation error at index 1:/),
        { command: "rm" },
      );
    });
  });
});
