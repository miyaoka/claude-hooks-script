import type { PreToolUseInput, PreToolUseResponse } from "../types/hook";
import { handleBashTool } from "./preToolUse/bash";

// ルールの型定義
export interface PreToolUseRule {
  matcher?: string;
  command?: string;
  args?: string;
  decision?: "block" | "approve";
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
  // ルールが空の場合は空のレスポンスを返す
  if (rules.length === 0) {
    return {};
  }

  // ツールごとに処理を振り分け
  switch (input.tool_name) {
    case "Bash":
      return handleBashTool(input, rules);
    default:
      // その他のツールは何もしない
      return {};
  }
};
