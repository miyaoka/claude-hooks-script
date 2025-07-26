import { parseBashCommand } from "../parsers/bashParser";
import type {
  BashPreToolUseInput,
  PreToolUseInput,
  PreToolUseResponse,
} from "../types/hook";
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

  // ルールの前処理：同じmatcher, command, argsの組み合わせは後のもので上書き
  const normalizedRules = normalizeRules(rules);

  // ツール名でマッチするルールをフィルタリング
  const toolMatchedRules = normalizedRules.filter((rule) => {
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

  // Bashツールの場合
  if (input.tool_name === "Bash") {
    return handleBashTool(input, toolMatchedRules);
  }

  // Bash以外のツールの場合
  return handleOtherTools(input, toolMatchedRules);
};

/**
 * Bashツール専用のハンドラー
 * コマンドを解析し、該当するルールを適用する
 */
function handleBashTool(
  input: BashPreToolUseInput,
  rules: PreToolUseRule[],
): PreToolUseResponse {
  // 型ガードによりinput.tool_input.commandは確実にstring
  const bashCommand = input.tool_input.command;
  if (!bashCommand) {
    return {};
  }

  const parsedCommands = parseBashCommand(bashCommand);
  const matchedRules: MatchedRule[] = [];

  // 各コマンドに対してルールをチェック
  parsedCommands.forEach((bashCommand) => {
    // 特定条件（argsあり）をチェック
    const specificRules = collectSpecificRules(rules, bashCommand);

    if (specificRules.length > 0) {
      // 特定ルールがマッチした場合は、それだけを使用
      matchedRules.push(...specificRules);
    } else {
      // 特定ルールがマッチしない場合のみ、デフォルト設定を使用
      const defaultRules = collectDefaultRules(rules, bashCommand.command);
      matchedRules.push(...defaultRules);
    }
  });

  return selectMostRestrictiveRule(matchedRules);
}

/**
 * ルールの正規化処理
 * 同じmatcher/command/argsの組み合わせを持つルールは最後のもので上書きし、
 * 元の配列での最後の出現位置を保持する
 */
export function normalizeRules(rules: PreToolUseRule[]): PreToolUseRule[] {
  const seen = new Set<string>();
  const result: PreToolUseRule[] = [];

  // 重複するキーは配列の後方のものを優先するため、逆順に走査して初出のもののみ採用
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (!rule) continue;

    const key = `${rule.matcher || ""}:${rule.command || ""}:${rule.args || ""}`;

    // 既に同じキーが存在する場合はスキップして採用しない
    if (seen.has(key)) continue;

    seen.add(key);
    result.unshift(rule); // 先頭に追加して元の順序を保つ
  }

  return result;
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

/**
 * 最も制限的なルールを選択
 * 優先順位: block > undefined > approve
 */
function selectMostRestrictiveRule(rules: MatchedRule[]): PreToolUseResponse {
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
