import { parseBashCommand } from "../../parsers/bashParser";
import type { BashPreToolUseInput, PreToolUseResponse } from "../../types/hook";
import { tryCatch } from "../../utils/result";
import type { PreToolUseRule } from "../preToolUse";

interface MatchedRule {
  decision: "block" | "approve" | undefined;
  reason: string;
}

/**
 * Bashツール専用のハンドラー
 * コマンドを解析し、該当するルールを適用する
 */
export function handleBashTool(
  input: BashPreToolUseInput,
  rules: PreToolUseRule[],
): PreToolUseResponse {
  // ルールの正規化（同じcommand, argsの組み合わせは後のもので上書き）
  const normalizedRules = normalizeBashRules(rules);
  const bashCommand = input.tool_input.command;
  if (!bashCommand) {
    return {};
  }

  const parsedCommands = parseBashCommand(bashCommand);
  const matchedRules: MatchedRule[] = [];

  // 各コマンドに対してルールをチェック
  parsedCommands.forEach((bashCommand) => {
    // 特定条件（argsあり）をチェック
    const specificRules = collectSpecificRules(normalizedRules, bashCommand);

    if (specificRules.length > 0) {
      // 特定ルールがマッチした場合は、それだけを使用
      matchedRules.push(...specificRules);
    } else {
      // 特定ルールがマッチしない場合のみ、デフォルト設定を使用
      const defaultRules = collectDefaultRules(
        normalizedRules,
        bashCommand.command,
      );
      matchedRules.push(...defaultRules);
    }
  });

  return selectMostRestrictiveRule(matchedRules);
}

/**
 * デフォルトルール（argsなし）を収集
 * 同じcommandを持つルールは最後のもので上書きされる
 */
function collectDefaultRules(
  rules: PreToolUseRule[],
  command: string,
): MatchedRule[] {
  if (!rules) return [];

  const defaultRules = new Map<string, MatchedRule>();

  rules.forEach((rule) => {
    if (rule.command === command && !rule.args) {
      defaultRules.set(rule.command, {
        decision: rule.decision,
        reason: rule.reason,
      });
    }
  });

  return Array.from(defaultRules.values());
}

/**
 * 特定条件ルール（argsあり）を収集
 * argsパターンにマッチするすべてのルールを返す
 */
function collectSpecificRules(
  rules: PreToolUseRule[],
  bashCommand: { command: string; args: string },
): MatchedRule[] {
  if (!rules) return [];

  const matchedRules: MatchedRule[] = [];

  rules.forEach((rule) => {
    if (rule.command !== bashCommand.command || !rule.args) return;

    const args = rule.args;
    const regexResult = tryCatch(() => new RegExp(args));

    if (regexResult.value) {
      if (regexResult.value.test(bashCommand.args)) {
        matchedRules.push({
          decision: rule.decision,
          reason: rule.reason,
        });
      }
    } else {
      // 無効な正規表現の場合は文字列として比較
      if (bashCommand.args.includes(args)) {
        matchedRules.push({
          decision: rule.decision,
          reason: rule.reason,
        });
      }
    }
  });

  return matchedRules;
}

/**
 * Bash用のルール正規化
 * 同じcommand/argsの組み合わせを持つルールは最後のもので上書き
 */
function normalizeBashRules(rules: PreToolUseRule[]): PreToolUseRule[] {
  const seen = new Set<string>();
  const result: PreToolUseRule[] = [];

  // 重複するキーは配列の後方のものを優先するため、逆順に走査して初出のもののみ採用
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (!rule) continue;

    const key = `${rule.command || ""}:${rule.args || ""}`;

    // 既に同じキーが存在する場合はスキップして採用しない
    if (seen.has(key)) continue;

    seen.add(key);
    result.unshift(rule); // 先頭に追加して元の順序を保つ
  }

  return result;
}

/**
 * 最も制限的なルールを選択
 * 優先順位: block > undefined > approve
 */
export function selectMostRestrictiveRule(
  rules: MatchedRule[],
): PreToolUseResponse {
  if (rules.length === 0) {
    return {};
  }

  // block > undefined > approve の優先順位
  const blockRule = rules.find((r) => r.decision === "block");
  if (blockRule) {
    return {
      decision: "block",
      reason: blockRule.reason,
    };
  }

  const undefinedRule = rules.find((r) => r.decision === undefined);
  if (undefinedRule) {
    return {
      reason: undefinedRule.reason,
    };
  }

  const approveRule = rules.find((r) => r.decision === "approve");
  if (approveRule) {
    return {
      decision: "approve",
      reason: approveRule.reason,
    };
  }

  return {};
}
