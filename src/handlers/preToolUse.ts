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
  tool: "Bash";
  command?: string;
  args?: string;
}

export interface WebFetchRule extends BaseRule {
  tool: "WebFetch";
  domain?: string;
}

export interface WebSearchRule extends BaseRule {
  tool: "WebSearch";
  query?: string;
}

export type PreToolUseRule = BashRule | WebFetchRule | WebSearchRule;

export interface RuleResult {
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
        rules.filter((rule) => rule.tool === "Bash"),
      );
    case "WebFetch":
      return handleWebFetchTool(
        input,
        rules.filter((rule) => rule.tool === "WebFetch"),
      );
    case "WebSearch":
      return handleWebSearchTool(
        input,
        rules.filter((rule) => rule.tool === "WebSearch"),
      );
    default:
      // その他のツールは何もしない
      return {};
  }
};
