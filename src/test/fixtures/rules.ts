import type {
  BashRule,
  WebFetchRule,
  WebSearchRule,
} from "../../handlers/preToolUse";

/**
 * テスト用のルールを作成するヘルパー関数
 */
export function createBashRule(override: Omit<BashRule, "event">): BashRule {
  return {
    event: "preToolUse",
    ...override,
  };
}

export function createWebFetchRule(
  override: Omit<WebFetchRule, "event">,
): WebFetchRule {
  return {
    event: "preToolUse",
    ...override,
  };
}

export function createWebSearchRule(
  override: Omit<WebSearchRule, "event">,
): WebSearchRule {
  return {
    event: "preToolUse",
    ...override,
  };
}
