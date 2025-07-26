import { describe, expect, it } from "bun:test";
import type { WebFetchPreToolUseInput } from "../../types/hook";
import type { PreToolUseRule, WebFetchRule } from "../preToolUse";
import { handlePreToolUse } from "../preToolUse";

// テスト用ヘルパー関数
function createWebFetchInput(
  url: string,
  prompt = "test prompt",
): WebFetchPreToolUseInput {
  return {
    session_id: "test-session",
    transcript_path: "/tmp/transcript.json",
    cwd: "/test/cwd",
    hook_event_name: "PreToolUse",
    tool_name: "WebFetch",
    tool_input: {
      url,
      prompt,
    },
  };
}

function createWebFetchRule(
  rule: Omit<WebFetchRule, "event" | "tool">,
): WebFetchRule {
  return {
    event: "preToolUse",
    tool: "WebFetch",
    ...rule,
  };
}

describe("handlePreToolUse - WebFetch", () => {
  describe("基本動作", () => {
    it("空のルールは空レスポンス", async () => {
      const input = createWebFetchInput("https://example.com");
      const response = await handlePreToolUse(input, []);
      expect(response).toEqual({});
    });

    it("ルール非マッチは空レスポンス", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          domain: "blocked\\.com",
          decision: "block",
          reason: "blocked.comは禁止",
        }),
      ];

      const input = createWebFetchInput("https://example.com");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({});
    });

    it("domainなしのデフォルトルール", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          decision: "approve",
          reason: "デフォルト許可",
        }),
      ];

      const input = createWebFetchInput("https://example.com");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "デフォルト許可",
      });
    });

    it("domainありの特定ルール", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          domain: "example\\.com",
          decision: "block",
          reason: "example.comは禁止",
        }),
      ];

      const input = createWebFetchInput("https://example.com/page");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "example.comは禁止",
      });
    });
  });

  describe("URLパース", () => {
    it("無効なURLは空レスポンス", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          decision: "block",
          reason: "全て禁止",
        }),
      ];

      const input = createWebFetchInput("not-a-valid-url");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({});
    });

    it("ポート番号付きURL（ポート番号は無視される）", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          domain: "example\\.com",
          decision: "block",
          reason: "example.comは禁止",
        }),
      ];

      const input = createWebFetchInput("https://example.com:8080/api");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "example.comは禁止",
      });
    });

    it("パスやクエリは無視してドメインのみ評価", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          domain: "api\\.example\\.com",
          decision: "approve",
          reason: "APIは許可",
        }),
      ];

      // 異なるパスやクエリでも同じドメインなら同じ結果
      const urls = [
        "https://api.example.com",
        "https://api.example.com/v1/users",
        "https://api.example.com/v2/posts?page=1",
        "https://api.example.com#section",
      ];

      for (const url of urls) {
        const input = createWebFetchInput(url);
        const response = await handlePreToolUse(input, rules);
        expect(response).toEqual({
          decision: "approve",
          reason: "APIは許可",
        });
      }
    });
  });

  describe("ドメインマッチングパターン", () => {
    it("完全一致", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          domain: "^example\\.com$",
          decision: "block",
          reason: "example.comのみ禁止",
        }),
      ];

      // マッチする
      const input1 = createWebFetchInput("https://example.com");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "example.comのみ禁止",
      });

      // マッチしない（サブドメイン）
      const input2 = createWebFetchInput("https://sub.example.com");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({});
    });

    it("サブドメイン対応", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          domain: ".*\\.example\\.com",
          decision: "block",
          reason: "example.comのサブドメインは禁止",
        }),
      ];

      // サブドメインはマッチ
      const input1 = createWebFetchInput("https://api.example.com");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "example.comのサブドメインは禁止",
      });

      // メインドメインはマッチしない
      const input2 = createWebFetchInput("https://example.com");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({});
    });

    it("複数ドメインのOR条件", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          domain: "google\\.com|facebook\\.com|twitter\\.com",
          decision: "block",
          reason: "SNSは禁止",
        }),
      ];

      const blockedUrls = [
        "https://google.com",
        "https://facebook.com",
        "https://twitter.com",
      ];

      for (const url of blockedUrls) {
        const input = createWebFetchInput(url);
        const response = await handlePreToolUse(input, rules);
        expect(response).toEqual({
          decision: "block",
          reason: "SNSは禁止",
        });
      }
    });
  });

  describe("ルール優先順位", () => {
    it("domainありがdomainなしより優先", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          decision: "approve",
          reason: "デフォルト許可",
        }),
        createWebFetchRule({
          domain: "blocked\\.com",
          decision: "block",
          reason: "blocked.comは禁止",
        }),
      ];

      const input = createWebFetchInput("https://blocked.com");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "blocked.comは禁止",
      });
    });

    it("block > undefined > approveの優先順位", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          domain: "test\\.com",
          decision: "approve",
          reason: "approve",
        }),
        createWebFetchRule({
          domain: "test",
          reason: "undefinedのreason",
        }),
        createWebFetchRule({
          domain: "com$",
          decision: "block",
          reason: "block",
        }),
      ];

      // 全てマッチ → blockが優先
      const input = createWebFetchInput("https://test.com");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "block",
      });
    });

    it("同じdomainは後勝ち", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          domain: "example\\.com",
          decision: "block",
          reason: "最初のルール",
        }),
        createWebFetchRule({
          domain: "example\\.com",
          decision: "approve",
          reason: "後のルール",
        }),
      ];

      const input = createWebFetchInput("https://example.com");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "後のルール",
      });
    });
  });

  describe("複雑なシナリオ", () => {
    it("複数domainルールの同時マッチ", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          domain: "\\.com$",
          decision: "approve",
          reason: ".comドメインは許可",
        }),
        createWebFetchRule({
          domain: "api\\.",
          decision: "approve",
          reason: "APIサブドメインは許可",
        }),
        createWebFetchRule({
          domain: "internal",
          decision: "block",
          reason: "internalを含むドメインは禁止",
        }),
      ];

      const input = createWebFetchInput("https://api.internal.example.com");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "internalを含むドメインは禁止",
      });
    });

    it("デフォルト + 特定ドメインの組み合わせ", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          decision: "block",
          reason: "デフォルト禁止",
        }),
        createWebFetchRule({
          domain: "^(localhost|127\\.0\\.0\\.1)",
          decision: "approve",
          reason: "ローカルは許可",
        }),
        createWebFetchRule({
          domain: "trusted\\.com",
          decision: "approve",
          reason: "信頼済みドメイン",
        }),
      ];

      // デフォルト禁止
      const input1 = createWebFetchInput("https://example.com");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "デフォルト禁止",
      });

      // ローカルは許可
      const input2 = createWebFetchInput("http://localhost:3000");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "approve",
        reason: "ローカルは許可",
      });

      // 信頼済みは許可
      const input3 = createWebFetchInput("https://trusted.com/api");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "approve",
        reason: "信頼済みドメイン",
      });
    });
  });

  describe("実用シナリオ", () => {
    it("開発環境と本番環境の制御", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          decision: "approve",
          reason: "デフォルト許可",
        }),
        createWebFetchRule({
          domain: "prod\\.example\\.com",
          decision: "block",
          reason: "本番環境への直接アクセスは禁止",
        }),
        createWebFetchRule({
          domain: "(dev|staging)\\.example\\.com",
          decision: "approve",
          reason: "開発・ステージング環境は許可",
        }),
      ];

      // 本番は禁止
      const input1 = createWebFetchInput("https://prod.example.com/api");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "本番環境への直接アクセスは禁止",
      });

      // 開発は許可
      const input2 = createWebFetchInput("https://dev.example.com/api");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "approve",
        reason: "開発・ステージング環境は許可",
      });
    });

    it("内部APIと外部APIの制御", async () => {
      const rules: PreToolUseRule[] = [
        createWebFetchRule({
          decision: "block",
          reason: "デフォルト禁止",
        }),
        createWebFetchRule({
          domain: "(localhost|127\\.0\\.0\\.1|internal\\.example\\.com)",
          decision: "approve",
          reason: "内部APIは許可",
        }),
        createWebFetchRule({
          domain: "public-api\\.example\\.com",
          decision: "approve",
          reason: "公開APIは許可",
        }),
      ];

      // 内部APIは許可
      const input1 = createWebFetchInput("https://internal.example.com/api");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "approve",
        reason: "内部APIは許可",
      });

      // 公開APIは許可
      const input2 = createWebFetchInput("https://public-api.example.com");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "approve",
        reason: "公開APIは許可",
      });

      // その他は禁止
      const input3 = createWebFetchInput("https://external-site.com");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "block",
        reason: "デフォルト禁止",
      });
    });
  });
});
