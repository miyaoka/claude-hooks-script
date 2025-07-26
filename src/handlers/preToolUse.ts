import type { PreToolUseInput, PreToolUseResponse } from "../types/hook";
import { debugLog } from "../utils/debug";
import { handleBashTool } from "./preToolUse/bash";
import { handleWebFetchTool } from "./preToolUse/webFetch";
import { handleWebSearchTool } from "./preToolUse/webSearch";

// ルールの型定義
interface BaseRule {
  decision?: "block" | "approve";
  reason: string;
}

export interface BashRule extends BaseRule {
  matcher: "Bash";
  command?: string;
  args?: string;
}

export interface WebFetchRule extends BaseRule {
  matcher: "WebFetch";
  domain?: string;
}

export interface WebSearchRule extends BaseRule {
  matcher: "WebSearch";
  query?: string;
}

export type PreToolUseRule = BashRule | WebFetchRule | WebSearchRule;

export interface MatchedRule {
  decision: "block" | "approve" | undefined;
  reason: string;
}

/**
 * PreToolUseフックのメインハンドラー
 * ツール実行前にルールに基づいて実行を許可/ブロックする
 */
export const handlePreToolUse = async (
  input: PreToolUseInput,
  rules: PreToolUseRule[],
): Promise<PreToolUseResponse> => {
  debugLog(JSON.stringify(input));

  // ルールが空の場合は空のレスポンスを返す
  if (rules.length === 0) {
    return {};
  }

  // ツールごとに処理を振り分け
  switch (input.tool_name) {
    case "Bash":
      return handleBashTool(
        input,
        rules.filter((rule) => rule.matcher === "Bash"),
      );
    case "WebFetch":
      return handleWebFetchTool(
        input,
        rules.filter((rule) => rule.matcher === "WebFetch"),
      );
    case "WebSearch":
      return handleWebSearchTool(
        input,
        rules.filter((rule) => rule.matcher === "WebSearch"),
      );
    default:
      // その他のツールは何もしない
      return {};
  }
};
