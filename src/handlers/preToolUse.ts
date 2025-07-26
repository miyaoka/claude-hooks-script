import type { PreToolUseInput, PreToolUseResponse } from "../types";
import { matchTool } from "../utils/matcher";
import { parseBashCommand } from "../utils/bashParser";
import { tryCatch } from "../utils/result";

// ルールの型定義
export interface PreToolUseRule {
  matcher?: string;
  command?: string;
  args?: string;
  decision: "block" | "approve";
  reason: string;
}

interface MatchedRule {
  decision: "block" | "approve" | undefined;
  reason: string;
}

export const handlePreToolUse = async (
  input: PreToolUseInput,
  rules?: PreToolUseRule[]
): Promise<PreToolUseResponse> => {
  // 設定がない場合は空のレスポンスを返す
  if (!rules || rules.length === 0) {
    return {};
  }

  // ツール名でマッチするルールをフィルタリング
  const matchingRules = rules.filter(rule => 
    matchTool(rule.matcher, input.tool_name)
  );

  if (matchingRules.length === 0) {
    return {};
  }

  // Bashツールの場合
  if (input.tool_name === "Bash") {
    return handleBashTool(input, matchingRules);
  }

  // Bash以外のツールの場合
  return handleOtherTools(input, matchingRules);
};

function handleBashTool(
  input: PreToolUseInput,
  matchingRules: PreToolUseRule[]
): PreToolUseResponse {
  const bashCommand = input.tool_input.command as string;
  if (!bashCommand) {
    return {};
  }

  const parsedCommands = parseBashCommand(bashCommand);
  const matchedRules: MatchedRule[] = [];

  // 各コマンドに対してルールをチェック
  parsedCommands.forEach(parsed => {
    // デフォルト設定（argsなし）を収集
    const defaultRules = collectDefaultRules(matchingRules, parsed.command);
    matchedRules.push(...defaultRules);

    // 特定条件（argsあり）をチェック
    const specificRules = collectSpecificRules(matchingRules, parsed);
    matchedRules.push(...specificRules);
  });

  return selectMostRestrictiveRule(matchedRules);
}

function collectDefaultRules(
  rules: PreToolUseRule[],
  command: string
): MatchedRule[] {
  if (!rules) return [];
  
  const defaultRules = new Map<string, MatchedRule>();
  
  rules.forEach(rule => {
    if (rule.command === command && !rule.args) {
      defaultRules.set(rule.command, {
        decision: rule.decision,
        reason: rule.reason
      });
    }
  });

  return Array.from(defaultRules.values());
}

function collectSpecificRules(
  rules: PreToolUseRule[],
  parsed: { command: string; args: string }
): MatchedRule[] {
  if (!rules) return [];
  
  const matchedRules: MatchedRule[] = [];

  rules.forEach(rule => {
    if (rule.command !== parsed.command || !rule.args) return;
    
    const args = rule.args;
    const regexResult = tryCatch(() => new RegExp(args));
    
    if (regexResult.value) {
      if (regexResult.value.test(parsed.args)) {
        matchedRules.push({
          decision: rule.decision,
          reason: rule.reason
        });
      }
    } else {
      // 無効な正規表現の場合は文字列として比較
      if (parsed.args.includes(args)) {
        matchedRules.push({
          decision: rule.decision,
          reason: rule.reason
        });
      }
    }
  });

  return matchedRules;
}

function handleOtherTools(
  input: PreToolUseInput,
  matchingRules: PreToolUseRule[]
): PreToolUseResponse {
  if (!matchingRules) return {};
  
  const matchedRules: MatchedRule[] = [];
  const inputValues = Object.values(input.tool_input).map(v => String(v));

  matchingRules.forEach(rule => {
    if (!rule.args) return;
    
    const args = rule.args;
    const matched = inputValues.some(value => {
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
        reason: rule.reason
      });
    }
  });

  return selectMostRestrictiveRule(matchedRules);
}

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