import { parseBashCommand } from "./bashParser";
import { matchPattern } from "./matcher";
import type {
  BashHookInput,
  BashRule,
  HookResponse,
  RuleResult,
} from "./types";

/**
 * Bashコマンド実行前のルール評価
 * コマンドを解析し、該当するルールから最も制限的な判断を返す
 */
export function checkBashCommand(
  input: BashHookInput,
  rules: BashRule[],
): HookResponse {
  const bashCommand = input.tool_input.command;
  if (!bashCommand) return {};
  if (rules.length === 0) return {};

  const normalizedRules = normalizeRules(rules);
  const parsedCommands = parseBashCommand(bashCommand);
  const matchedRules: RuleResult[] = [];

  parsedCommands.forEach((parsed) => {
    // args指定ありのルールを優先的にチェック
    const specific = collectSpecificRules(normalizedRules, parsed);

    if (specific.length > 0) {
      matchedRules.push(...specific);
      return;
    }
    // 特定ルールがマッチしない場合のみデフォルト（args指定なし）を使う
    matchedRules.push(...collectDefaultRules(normalizedRules, parsed.command));
  });

  return selectMostRestrictive(matchedRules);
}

/**
 * 同じcommand/argsの組み合わせを持つルールは最後のもので上書き
 */
function normalizeRules(rules: BashRule[]): BashRule[] {
  const seen = new Set<string>();
  const result: BashRule[] = [];

  // 重複するキーは配列の後方のものを優先するため、逆順に走査して初出のもののみ採用
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (!rule) continue;

    const key = `${rule.command}:${rule.args || ""}`;
    if (seen.has(key)) continue;

    seen.add(key);
    result.unshift(rule);
  }

  return result;
}

/**
 * デフォルトルール（argsなし）を収集
 */
function collectDefaultRules(rules: BashRule[], command: string): RuleResult[] {
  const defaults = new Map<string, RuleResult>();

  rules.forEach((rule) => {
    if (rule.command !== command || rule.args) return;
    defaults.set(rule.command, {
      decision: rule.decision,
      reason: rule.reason,
    });
  });

  return Array.from(defaults.values());
}

/**
 * 特定条件ルール（argsあり）を収集
 */
function collectSpecificRules(
  rules: BashRule[],
  parsed: { command: string; args: string },
): RuleResult[] {
  const matched: RuleResult[] = [];

  rules.forEach((rule) => {
    if (rule.command !== parsed.command || !rule.args) return;
    if (!matchPattern(rule.args, parsed.args)) return;
    matched.push({ decision: rule.decision, reason: rule.reason });
  });

  return matched;
}

/**
 * 最も制限的なルールを選択
 * 優先順位: block > undefined > approve
 */
function selectMostRestrictive(rules: RuleResult[]): HookResponse {
  if (rules.length === 0) return {};

  const block = rules.find((r) => r.decision === "block");
  if (block) {
    return { decision: "block", reason: block.reason };
  }

  const undef = rules.find((r) => r.decision === undefined);
  if (undef) {
    return { reason: undef.reason };
  }

  const approve = rules.find((r) => r.decision === "approve");
  if (approve) {
    return { decision: "approve", reason: approve.reason };
  }

  return {};
}
