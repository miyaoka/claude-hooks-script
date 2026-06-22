import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { formatError, readConfig, validateConfig } from "./config";
import type { HookConfig } from "./types";

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
    it("allow（reason なし）", () => {
      expect(validateConfig([{ command: "ls", permissionDecision: "allow" }])).toBe(true);
    });

    it("deny + reason", () => {
      expect(
        validateConfig([
          { command: "rm", permissionDecision: "deny", permissionDecisionReason: "危険" },
        ]),
      ).toBe(true);
    });

    it("ask + reason", () => {
      expect(
        validateConfig([
          { command: "psql", permissionDecision: "ask", permissionDecisionReason: "確認" },
        ]),
      ).toBe(true);
    });

    it("defer", () => {
      expect(validateConfig([{ command: "ls", permissionDecision: "defer" }])).toBe(true);
    });

    it("additionalContext 単体（decision なし）", () => {
      expect(validateConfig([{ command: "curl", additionalContext: "注意" }])).toBe(true);
    });

    it("allow + additionalContext", () => {
      expect(
        validateConfig([
          { command: "psql", permissionDecision: "allow", additionalContext: "本番DB" },
        ]),
      ).toBe(true);
    });

    it("allow + updatedInput", () => {
      expect(
        validateConfig([
          {
            command: "npm",
            args: "test",
            permissionDecision: "allow",
            updatedInput: { command: "npm test --silent" },
          },
        ]),
      ).toBe(true);
    });

    it("ワイルドカードルール (args あり)", () => {
      expect(
        validateConfig([
          {
            command: "*",
            args: "node_modules",
            permissionDecision: "deny",
            permissionDecisionReason: "禁止",
          },
        ]),
      ).toBe(true);
    });

    it("空配列", () => {
      expect(validateConfig([])).toBe(true);
    });
  });

  describe("マッチパターンのエラー", () => {
    it('args なしの "*" を拒否', () => {
      expect(
        validateConfig([
          { command: "*", permissionDecision: "deny", permissionDecisionReason: "x" },
        ]),
      ).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining('wildcard rule (command: "*") requires args'),
        expect.anything(),
      );
    });

    it("command 欠落を拒否", () => {
      expect(validateConfig([{ permissionDecision: "allow" }])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("command must be a string"),
        expect.anything(),
      );
    });

    it("args が非 string を拒否", () => {
      expect(validateConfig([{ command: "ls", args: 123, permissionDecision: "allow" }])).toBe(
        false,
      );
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("args must be a string when present"),
        expect.anything(),
      );
    });
  });

  describe("公式レスポンスフィールドのエラー", () => {
    it("permissionDecision の無効値を拒否", () => {
      expect(validateConfig([{ command: "ls", permissionDecision: "warn" }])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining(
          'permissionDecision must be one of "allow" / "deny" / "ask" / "defer"',
        ),
        expect.anything(),
      );
    });

    it("deny で reason 欠落を拒否", () => {
      expect(validateConfig([{ command: "rm", permissionDecision: "deny" }])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining('permissionDecision "deny" requires permissionDecisionReason'),
        expect.anything(),
      );
    });

    it("ask で reason 欠落を拒否", () => {
      expect(validateConfig([{ command: "psql", permissionDecision: "ask" }])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining('permissionDecision "ask" requires permissionDecisionReason'),
        expect.anything(),
      );
    });

    it("allow に reason を付けると拒否（公式上非表示）", () => {
      expect(
        validateConfig([
          { command: "ls", permissionDecision: "allow", permissionDecisionReason: "意味なし" },
        ]),
      ).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining(
          'permissionDecisionReason is only valid with permissionDecision "deny" or "ask"',
        ),
        expect.anything(),
      );
    });

    it("空の permissionDecisionReason を拒否", () => {
      expect(
        validateConfig([
          { command: "rm", permissionDecision: "deny", permissionDecisionReason: "" },
        ]),
      ).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("permissionDecisionReason must not be empty"),
        expect.anything(),
      );
    });

    it("空の additionalContext を拒否", () => {
      expect(validateConfig([{ command: "ls", additionalContext: "" }])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("additionalContext must not be empty"),
        expect.anything(),
      );
    });

    it("updatedInput を allow 以外に付けると拒否", () => {
      expect(
        validateConfig([
          {
            command: "rm",
            permissionDecision: "deny",
            permissionDecisionReason: "x",
            updatedInput: { command: "ls" },
          },
        ]),
      ).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining('updatedInput is only valid with permissionDecision "allow"'),
        expect.anything(),
      );
    });

    it("updatedInput.command 欠落を拒否", () => {
      expect(
        validateConfig([{ command: "npm", permissionDecision: "allow", updatedInput: {} }]),
      ).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("updatedInput.command must be a non-empty string"),
        expect.anything(),
      );
    });

    it("permissionDecision も additionalContext も無いルールを拒否", () => {
      expect(validateConfig([{ command: "ls" }])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("rule must set permissionDecision or additionalContext"),
        expect.anything(),
      );
    });
  });

  describe("配列構造エラー", () => {
    it("非配列を拒否", () => {
      expect(validateConfig({})).toBe(false);
      expect(errorMock).toHaveBeenCalledWith("Config validation error: Config must be an array");
    });

    it("配列内 null を拒否", () => {
      expect(validateConfig([null])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("rule must be a plain object"),
        null,
      );
    });
  });

  describe("旧スキーマ検出 (未知フィールド)", () => {
    it("旧 decision/reason を未知フィールドとして拒否し移行を促す", () => {
      const oldRule = { command: "rm", decision: "deny", reason: "rm禁止" };
      expect(validateConfig([oldRule])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("unknown fields: decision, reason"),
        oldRule,
      );
    });

    it("v0 Bash ルール (event/tool 付き) を未知フィールドエラーで拒否", () => {
      const oldRule = { command: "rm", event: "preToolUse", tool: "Bash", additionalContext: "x" };
      expect(validateConfig([oldRule])).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringContaining("unknown fields: event, tool"),
        oldRule,
      );
    });
  });

  describe("インデックス付きエラー出力", () => {
    it("複数ルールで invalid なものだけ index 付きでエラーを出す", () => {
      expect(
        validateConfig([
          { command: "ls", permissionDecision: "allow" },
          { command: "rm" }, // 効果なし
          { command: "cat", permissionDecision: "allow" },
        ]),
      ).toBe(false);
      expect(errorMock).toHaveBeenCalledWith(
        expect.stringMatching(/^Config validation error at index 1:/),
        { command: "rm" },
      );
    });
  });
});

describe("readConfig", () => {
  let errorMock: ReturnType<typeof mock>;
  let originalError: typeof console.error;
  let dir: string;

  beforeEach(() => {
    errorMock = mock(() => {});
    originalError = console.error;
    console.error = errorMock as unknown as typeof console.error;
    dir = mkdtempSync(join(tmpdir(), "hooks-config-test-"));
  });

  afterEach(() => {
    console.error = originalError;
    rmSync(dir, { recursive: true, force: true });
  });

  it("存在しないパスは undefined を返し read error を出す（catch 経路）", () => {
    const path = join(dir, "missing.json");
    expect(readConfig(path)).toBeUndefined();
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining(`Config read error for ${path}`),
    );
  });

  it("不正な JSON は undefined を返し read error を出す（SyntaxError 経路）", () => {
    const path = join(dir, "broken.json");
    writeFileSync(path, "{ not valid json");
    expect(readConfig(path)).toBeUndefined();
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining(`Config read error for ${path}`),
    );
  });

  it("検証エラーの設定は undefined を返し validation failed を出す", () => {
    const path = join(dir, "invalid-schema.json");
    writeFileSync(path, JSON.stringify([{ command: "ls" }])); // 効果なし
    expect(readConfig(path)).toBeUndefined();
    expect(errorMock).toHaveBeenCalledWith(`Config validation failed for ${path}`);
  });

  it("正常な設定はパースして返す", () => {
    const path = join(dir, "valid.json");
    const config: HookConfig = [
      { command: "rm", permissionDecision: "deny", permissionDecisionReason: "禁止" },
    ];
    writeFileSync(path, JSON.stringify(config));
    expect(readConfig(path)).toEqual(config);
  });
});

describe("formatError", () => {
  it("string はそのまま返す", () => {
    expect(formatError("そのままの文字列")).toBe("そのままの文字列");
  });

  it("Error は message を返す", () => {
    expect(formatError(new Error("エラーメッセージ"))).toBe("エラーメッセージ");
  });

  it("string でも Error でもない値は String() で変換する", () => {
    expect(formatError(42)).toBe("42");
    expect(formatError(null)).toBe("null");
    expect(formatError({ a: 1 })).toBe("[object Object]");
  });
});
