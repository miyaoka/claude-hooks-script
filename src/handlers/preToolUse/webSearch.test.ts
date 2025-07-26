import { describe, expect, it } from "bun:test";
import type { WebSearchPreToolUseInput } from "../../types/hook";
import type { PreToolUseRule, WebSearchRule } from "../preToolUse";
import { handlePreToolUse } from "../preToolUse";

// テスト用ヘルパー関数
function createWebSearchInput(query: string): WebSearchPreToolUseInput {
  return {
    session_id: "test-session",
    transcript_path: "/tmp/transcript.json",
    cwd: "/test/cwd",
    hook_event_name: "PreToolUse",
    tool_name: "WebSearch",
    tool_input: {
      query,
    },
  };
}

function createWebSearchRule(
  rule: Omit<WebSearchRule, "event" | "tool">,
): WebSearchRule {
  return {
    event: "preToolUse",
    tool: "WebSearch",
    ...rule,
  };
}

describe("handlePreToolUse - WebSearch", () => {
  describe("基本動作", () => {
    it("空のルールは空レスポンス", async () => {
      const input = createWebSearchInput("test query");
      const response = await handlePreToolUse(input, []);
      expect(response).toEqual({});
    });

    it("ルール非マッチは空レスポンス", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          query: "forbidden",
          decision: "block",
          reason: "forbiddenクエリは禁止",
        }),
      ];

      const input = createWebSearchInput("allowed query");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({});
    });

    it("queryなしのデフォルトルール", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          decision: "approve",
          reason: "デフォルト許可",
        }),
      ];

      const input = createWebSearchInput("any query");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "デフォルト許可",
      });
    });

    it("queryありの特定ルール", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          query: "password",
          decision: "block",
          reason: "パスワード検索は禁止",
        }),
      ];

      const input = createWebSearchInput("how to reset password");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "パスワード検索は禁止",
      });
    });
  });

  describe("クエリマッチングパターン", () => {
    it("部分一致（大文字小文字無視）", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          query: "secret",
          decision: "block",
          reason: "機密情報の検索は禁止",
        }),
      ];

      // 大文字でもマッチ
      const input = createWebSearchInput("Company SECRET documents");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "機密情報の検索は禁止",
      });
    });

    it("正規表現マッチ", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          query: "^how to",
          decision: "approve",
          reason: "How-to検索は許可",
        }),
        createWebSearchRule({
          query: "\\?$",
          decision: "approve",
          reason: "質問形式は許可",
        }),
        createWebSearchRule({
          query: "\\b(hack|crack|exploit)\\b",
          decision: "block",
          reason: "不正アクセス関連は禁止",
        }),
      ];

      // "how to"で始まる
      const input1 = createWebSearchInput("how to use git");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "approve",
        reason: "How-to検索は許可",
      });

      // ?で終わる
      const input2 = createWebSearchInput("what is typescript?");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "approve",
        reason: "質問形式は許可",
      });

      // 単語境界でマッチ
      const input3 = createWebSearchInput("how to hack a system");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "block",
        reason: "不正アクセス関連は禁止",
      });
    });

    it("特殊文字を含むクエリ", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          query: "\\$\\$\\$",
          decision: "block",
          reason: "金銭関連の検索は禁止",
        }),
      ];

      const input = createWebSearchInput("make $$$ fast");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "金銭関連の検索は禁止",
      });
    });

    it("無効な正規表現は文字列マッチ", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          query: "[invalid",
          decision: "block",
          reason: "特殊文字を含む",
        }),
      ];

      const input = createWebSearchInput("search [invalid regex");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "特殊文字を含む",
      });
    });
  });

  describe("ルール優先順位", () => {
    it("queryありがqueryなしより優先", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          decision: "approve",
          reason: "デフォルト許可",
        }),
        createWebSearchRule({
          query: "internal",
          decision: "block",
          reason: "内部情報の検索は禁止",
        }),
      ];

      const input = createWebSearchInput("internal documentation");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "内部情報の検索は禁止",
      });
    });

    it("block > undefined > approveの優先順位", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          query: "test",
          decision: "approve",
          reason: "テストは許可",
        }),
        createWebSearchRule({
          query: "search",
          reason: "検索に関する警告（decisionなし）",
        }),
        createWebSearchRule({
          query: "forbidden",
          decision: "block",
          reason: "禁止ワード",
        }),
      ];

      // 全てマッチ → blockが優先
      const input1 = createWebSearchInput("test search forbidden");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "禁止ワード",
      });

      // approve + undefined → undefinedが優先
      const input2 = createWebSearchInput("test search");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        reason: "検索に関する警告（decisionなし）",
      });

      // approveのみ
      const input3 = createWebSearchInput("test only");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "approve",
        reason: "テストは許可",
      });
    });

    it("同じqueryは後勝ち", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          query: "python",
          decision: "block",
          reason: "最初のルール",
        }),
        createWebSearchRule({
          query: "python",
          decision: "approve",
          reason: "後のルール",
        }),
      ];

      const input = createWebSearchInput("python tutorial");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "approve",
        reason: "後のルール",
      });
    });
  });

  describe("複雑なシナリオ", () => {
    it("複数queryルールの同時マッチ", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          query: "tutorial",
          decision: "approve",
          reason: "チュートリアルは許可",
        }),
        createWebSearchRule({
          query: "beginner",
          decision: "approve",
          reason: "初心者向けコンテンツは許可",
        }),
        createWebSearchRule({
          query: "torrent|pirate|crack",
          decision: "block",
          reason: "著作権侵害の可能性",
        }),
      ];

      const input = createWebSearchInput("beginner tutorial for cracking");
      const response = await handlePreToolUse(input, rules);
      expect(response).toEqual({
        decision: "block",
        reason: "著作権侵害の可能性",
      });
    });

    it("デフォルト + 特定クエリの組み合わせ", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          decision: "block",
          reason: "デフォルト禁止",
        }),
        createWebSearchRule({
          query: "^(site:|inurl:|filetype:)",
          decision: "approve",
          reason: "高度な検索演算子は許可",
        }),
        createWebSearchRule({
          query: "documentation|tutorial|guide",
          decision: "approve",
          reason: "学習リソースは許可",
        }),
      ];

      // デフォルト禁止
      const input1 = createWebSearchInput("random search");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "デフォルト禁止",
      });

      // 検索演算子は許可
      const input2 = createWebSearchInput("site:github.com typescript");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "approve",
        reason: "高度な検索演算子は許可",
      });

      // 学習リソースは許可
      const input3 = createWebSearchInput("react documentation");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "approve",
        reason: "学習リソースは許可",
      });
    });
  });

  describe("実用シナリオ", () => {
    it("技術検索の制御", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          decision: "approve",
          reason: "デフォルト許可",
        }),
        createWebSearchRule({
          query: "prevent.*injection|injection.*protection",
          decision: "approve",
          reason: "セキュリティ対策の検索は許可",
        }),
        createWebSearchRule({
          query: "(sql|database).*injection",
          decision: "block",
          reason: "セキュリティ攻撃手法の検索は禁止",
        }),
      ];

      // 攻撃手法は禁止
      const input1 = createWebSearchInput("sql injection tutorial");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "セキュリティ攻撃手法の検索は禁止",
      });

      // 対策も両方マッチしてblockが優先
      const input2 = createWebSearchInput("prevent sql injection");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "block",
        reason: "セキュリティ攻撃手法の検索は禁止",
      });

      // 通常の技術検索は許可
      const input3 = createWebSearchInput("javascript array methods");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "approve",
        reason: "デフォルト許可",
      });
    });

    it("個人情報・機密情報の検索制御", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          query: "\\b\\d{3}-?\\d{2}-?\\d{4}\\b",
          decision: "block",
          reason: "SSN形式の検索は禁止",
        }),
        createWebSearchRule({
          query: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
          decision: "block",
          reason: "メールアドレスの検索は禁止",
        }),
        createWebSearchRule({
          query: "password|passwd|pwd",
          decision: "block",
          reason: "パスワード関連の検索は禁止",
        }),
      ];

      // SSN形式
      const input1 = createWebSearchInput("find 123-45-6789");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "block",
        reason: "SSN形式の検索は禁止",
      });

      // メールアドレス
      const input2 = createWebSearchInput("contact john@example.com");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "block",
        reason: "メールアドレスの検索は禁止",
      });

      // パスワード
      const input3 = createWebSearchInput("reset password");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "block",
        reason: "パスワード関連の検索は禁止",
      });
    });

    it("言語別の検索制御", async () => {
      const rules: PreToolUseRule[] = [
        createWebSearchRule({
          decision: "approve",
          reason: "デフォルト許可",
        }),
        createWebSearchRule({
          query: "[\\u4e00-\\u9fff\\u3040-\\u309f\\u30a0-\\u30ff]",
          decision: "approve",
          reason: "日本語検索は許可",
        }),
        createWebSearchRule({
          query: "[\\u0400-\\u04ff]",
          decision: "block",
          reason: "キリル文字の検索は禁止",
        }),
      ];

      // 日本語は許可
      const input1 = createWebSearchInput("TypeScript チュートリアル");
      const response1 = await handlePreToolUse(input1, rules);
      expect(response1).toEqual({
        decision: "approve",
        reason: "日本語検索は許可",
      });

      // 英語のみも許可
      const input2 = createWebSearchInput("TypeScript tutorial");
      const response2 = await handlePreToolUse(input2, rules);
      expect(response2).toEqual({
        decision: "approve",
        reason: "デフォルト許可",
      });

      // キリル文字は禁止
      const input3 = createWebSearchInput("программирование");
      const response3 = await handlePreToolUse(input3, rules);
      expect(response3).toEqual({
        decision: "block",
        reason: "キリル文字の検索は禁止",
      });
    });
  });
});
