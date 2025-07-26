import type { PreToolUseInput, PreToolUseResponse } from "../types/hook";
import { tryCatch } from "../utils/result";
import { handleBashTool, selectMostRestrictiveRule } from "./preToolUse/bash";

// ルールの型定義
export interface PreToolUseRule {
  matcher?: string;
  command?: string;
  args?: string;
  decision?: "block" | "approve";
  reason: string;
}

interface MatchedRule {
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
  // ルールが空の場合は空のレスポンスを返す
  if (rules.length === 0) {
    return {};
  }

  // ツール名でマッチするルールをフィルタリング
  const toolMatchedRules = rules.filter((rule) => {
    // 空文字またはundefinedはすべてにマッチ
    if (!rule.matcher) return true;

    const regexResult = tryCatch(() => new RegExp(`^${rule.matcher}$`));

    if (regexResult.value) {
      // 正規表現として評価
      return regexResult.value.test(input.tool_name);
    }

    // 無効な正規表現の場合は文字列として完全一致で比較
    return rule.matcher === input.tool_name;
  });

  if (toolMatchedRules.length === 0) {
    return {};
  }

  // ツールごとに処理を振り分け
  if (input.tool_name === "Bash") {
    return handleBashTool(input, toolMatchedRules);
  }

  // Bash以外のツールの場合
  return handleOtherTools(input, toolMatchedRules);
};

/**
 * Bash以外のツール用のハンドラー
 * tool_inputの各値に対してargsパターンマッチングを行う
 */
function handleOtherTools(
  input: PreToolUseInput,
  rules: PreToolUseRule[],
): PreToolUseResponse {
  if (!rules) return {};

  const matchedRules: MatchedRule[] = [];
  const inputValues = Object.values(input.tool_input).map((v) => String(v));

  rules.forEach((rule) => {
    if (!rule.args) return;

    const args = rule.args;
    const matched = inputValues.some((value) => {
      const regexResult = tryCatch(() => new RegExp(args));

      if (regexResult.value) {
        return regexResult.value.test(value);
      } else {
        // 無効な正規表現の場合は文字列として部分一致で比較
        return value.includes(args);
      }
    });

    if (matched) {
      matchedRules.push({
        decision: rule.decision,
        reason: rule.reason,
      });
    }
  });

  return selectMostRestrictiveRule(matchedRules);
}
