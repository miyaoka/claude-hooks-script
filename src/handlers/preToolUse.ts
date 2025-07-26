import type { PreToolUseInput, PreToolUseResponse } from "../types/hook";
import { debugLog } from "../utils/debug";
import { handleBashTool } from "./preToolUse/bash";
import { handleWebFetchTool } from "./preToolUse/webFetch";

// ルールの型定義
export interface PreToolUseRule {
  matcher?: string;
  command?: string;
  args?: string;
  decision?: "block" | "approve";
  reason: string;
  domain?: string;
}

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
      return handleBashTool(input, rules);
    case "WebFetch":
      return handleWebFetchTool(input, rules);
    default:
      // その他のツールは何もしない
      return {};
  }
};
