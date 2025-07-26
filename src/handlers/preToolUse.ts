import type { PreToolUseInput, PreToolUseResponse } from "../types/hook";
import { matchTool } from "../matchers/matcher";
import { parseBashCommand } from "../parsers/bashParser";
import { tryCatch } from "../utils/result";

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
    // 特定条件（argsあり）をチェック
    const specificRules = collectSpecificRules(matchingRules, parsed);
    
    if (specificRules.length > 0) {
      // 特定ルールがマッチした場合は、それだけを使用
      matchedRules.push(...specificRules);
    } else {
      // 特定ルールがマッチしない場合のみ、デフォルト設定を使用
      const defaultRules = collectDefaultRules(matchingRules, parsed.command);
      matchedRules.push(...defaultRules);
    }
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
  
  // command+argsの組み合わせごとにMapで管理（後の定義で上書き）
  const specificRulesMap = new Map<string, MatchedRule>();
  const matchedRules: MatchedRule[] = [];

  rules.forEach(rule => {
    if (rule.command !== parsed.command || !rule.args) return;
    
    const args = rule.args;
    const regexResult = tryCatch(() => new RegExp(args));
    
    if (regexResult.value) {
      if (regexResult.value.test(parsed.args)) {
        // マッチした場合、複数のルールが適用される可能性があるので配列に追加
        matchedRules.push({
          decision: rule.decision,
          reason: rule.reason
        });
      }
    } else {
      // 無効な正規表現の場合は文字列として比較
      if (parsed.args.includes(args)) {
        // 文字列マッチの場合はMapで管理（同じargsは後で上書き）
        const key = `${rule.command}:${rule.args}`;
        specificRulesMap.set(key, {
          decision: rule.decision,
          reason: rule.reason
        });
      }
    }
  });

  // Mapの値を配列に追加
  return [...matchedRules, ...Array.from(specificRulesMap.values())];
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