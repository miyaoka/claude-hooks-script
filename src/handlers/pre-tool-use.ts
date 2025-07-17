import type { PreToolUseInput, PreToolUseResponse } from "../types";
import { matchTool } from "../utils/matcher";
import { parseBashCommand } from "../utils/bash-parser";

// 設定の型定義
export interface PreToolUseConfig {
  preToolUse?: Array<{
    matcher?: string;
    command?: string;
    args?: string;
    decision: "block" | "approve";
    reason: string;
  }>;
}

interface MatchedRule {
  decision: "block" | "approve" | undefined;
  reason: string;
}

export const handlePreToolUse = async (
  input: PreToolUseInput,
  config?: PreToolUseConfig
): Promise<PreToolUseResponse> => {
  // 設定がない場合は空のレスポンスを返す
  if (!config?.preToolUse || config.preToolUse.length === 0) {
    return {};
  }

  // ツール名でマッチするルールをフィルタリング
  const matchingRules = config.preToolUse.filter(rule => 
    matchTool(rule.matcher, input.tool_name)
  );

  if (matchingRules.length === 0) {
    return {};
  }

  // Bashツールの場合はコマンド解析
  if (input.tool_name === "Bash") {
    const bashCommand = input.tool_input.command as string;
    if (!bashCommand) {
      return {};
    }

    const parsedCommands = parseBashCommand(bashCommand);
    const matchedRules: MatchedRule[] = [];

    // 各コマンドに対してルールをチェック
    for (const parsed of parsedCommands) {
      // まずデフォルト設定（argsなし）を収集
      const defaultRules = new Map<string, MatchedRule>();
      
      for (const rule of matchingRules) {
        if (rule.command === parsed.command && !rule.args) {
          defaultRules.set(rule.command, {
            decision: rule.decision,
            reason: rule.reason
          });
        }
      }

      // デフォルト設定をmatchedRulesに追加
      defaultRules.forEach(rule => {
        matchedRules.push(rule);
      });

      // 次に特定条件（argsあり）をチェック
      for (const rule of matchingRules) {
        if (rule.command === parsed.command && rule.args) {
          try {
            const argsRegex = new RegExp(rule.args);
            if (argsRegex.test(parsed.args)) {
              matchedRules.push({
                decision: rule.decision,
                reason: rule.reason
              });
            }
          } catch {
            // 無効な正規表現の場合は文字列として比較
            if (parsed.args.includes(rule.args)) {
              matchedRules.push({
                decision: rule.decision,
                reason: rule.reason
              });
            }
          }
        }
      }
    }

    // matchedRulesから最も制限的なdecisionを選択
    return selectMostRestrictiveRule(matchedRules);
  }

  // Bash以外のツールの場合
  const matchedRules: MatchedRule[] = [];
  
  // argsパターンでチェック（tool_inputの各値に対して）
  for (const rule of matchingRules) {
    if (rule.args) { // Bash以外ではcommandは無視（あっても処理する）
      // tool_inputの各値を文字列に変換してパターンマッチ
      const inputValues = Object.values(input.tool_input).map(v => String(v));
      
      for (const value of inputValues) {
        try {
          const argsRegex = new RegExp(rule.args);
          if (argsRegex.test(value)) {
            matchedRules.push({
              decision: rule.decision,
              reason: rule.reason
            });
            break; // 一つでもマッチしたらこのルールは適用
          }
        } catch {
          // 無効な正規表現の場合は文字列として部分一致で比較
          if (value.includes(rule.args)) {
            matchedRules.push({
              decision: rule.decision,
              reason: rule.reason
            });
            break;
          }
        }
      }
    }
  }
  
  return selectMostRestrictiveRule(matchedRules);
};

function selectMostRestrictiveRule(rules: MatchedRule[]): PreToolUseResponse {
  if (rules.length === 0) {
    return {};
  }

  // block > undefined > approve の優先順位
  const blockRule = rules.find(r => r.decision === "block");
  if (blockRule) {
    return {
      decision: "block",
      reason: blockRule.reason
    };
  }

  const undefinedRule = rules.find(r => r.decision === undefined);
  if (undefinedRule) {
    return {
      reason: undefinedRule.reason
    };
  }

  const approveRule = rules.find(r => r.decision === "approve");
  if (approveRule) {
    return {
      decision: "approve",
      reason: approveRule.reason
    };
  }

  return {};
}