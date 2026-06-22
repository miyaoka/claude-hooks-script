import { parseBashCommand } from "./bashParser";
import { matchPattern } from "./matcher";
import { WILDCARD_COMMAND } from "./types";
import type {
  BashHookInput,
  BashRule,
  DecidedOutput,
  HookResponse,
  PermissionDecision,
  PreToolUseDecision,
  PreToolUseHookOutput,
} from "./types";

/**
 * Bashコマンド実行前のルール評価。
 * マッチしたルールの公式レスポンスフィールドをそのまま素通しで返し、
 * 複数マッチ時のみ単一レスポンスへ合成する
 */
export function checkBashCommand(input: BashHookInput, rules: BashRule[]): HookResponse {
  const bashCommand = input.tool_input.command;
  if (!bashCommand) return {};
  if (rules.length === 0) return {};

  const normalizedRules = normalizeRules(rules);
  const wildcardRules = normalizedRules.filter((rule) => rule.command === WILDCARD_COMMAND);
  const commandRules = normalizedRules.filter((rule) => rule.command !== WILDCARD_COMMAND);

  const matched: PreToolUseDecision[] = collectWildcardRules(wildcardRules, bashCommand);
  const parsedCommands = parseBashCommand(bashCommand);

  parsedCommands.forEach((parsed) => {
    // args指定ありのルールを優先的にチェック
    const specific = collectSpecificRules(commandRules, parsed);

    if (specific.length > 0) {
      matched.push(...specific);
      return;
    }
    // 特定ルールがマッチしない場合のみデフォルト（args指定なし）を使う
    matched.push(...collectDefaultRules(commandRules, parsed.command));
  });

  return combine(matched);
}

/**
 * ルールからマッチパターン（command / args）を除いた公式レスポンスフィールドを取り出す。
 * 残り = そのまま hookSpecificOutput に載せる素通し分
 */
function toOutput(rule: BashRule): PreToolUseDecision {
  const { command: _command, args: _args, ...output } = rule;
  return output;
}

/**
 * ワイルドカードルールを生のコマンド文字列全体と照合する。
 * コマンド分割後のargsだと変数代入（f=/path; cat "$f"）でパターンが引数から消えるため、
 * 分割前の文字列に当てて迂回を防ぐ
 */
function collectWildcardRules(rules: BashRule[], rawCommand: string): PreToolUseDecision[] {
  return rules
    .filter((rule) => rule.args !== undefined && matchPattern(rule.args, rawCommand))
    .map(toOutput);
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
function collectDefaultRules(rules: BashRule[], command: string): PreToolUseDecision[] {
  const defaults = new Map<string, PreToolUseDecision>();

  rules.forEach((rule) => {
    if (rule.command !== command || rule.args) return;
    defaults.set(rule.command, toOutput(rule));
  });

  return Array.from(defaults.values());
}

/**
 * 特定条件ルール（argsあり）を収集
 */
function collectSpecificRules(
  rules: BashRule[],
  parsed: { command: string; args: string },
): PreToolUseDecision[] {
  const matched: PreToolUseDecision[] = [];

  rules.forEach((rule) => {
    if (rule.command !== parsed.command || !rule.args) return;
    if (!matchPattern(rule.args, parsed.args)) return;
    matched.push(toOutput(rule));
  });

  return matched;
}

// permissionDecision の優先順位（公式: deny > defer > ask > allow。小さいほど優先）
const DECISION_RANK: Record<PermissionDecision, number> = {
  deny: 0,
  defer: 1,
  ask: 2,
  allow: 3,
};

/**
 * マッチした複数ルールの公式フィールドを単一レスポンスへ合成する。
 * - permissionDecision: 優先順位 deny > defer > ask > allow で採用し、その reason / updatedInput を引き継ぐ
 * - additionalContext: マッチした全ルールの値を集約（公式も複数値を全配信する）。
 *   ただし defer は additionalContext を無視するため、defer 採用時は付けない
 */
function combine(outputs: PreToolUseDecision[]): HookResponse {
  if (outputs.length === 0) return {};

  const winner = mostRestrictive(outputs);

  // defer は additionalContext を無視するので付与せずそのまま返す
  if (winner?.permissionDecision === "defer") {
    return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "defer" } };
  }

  const contexts = outputs
    .map((o) => ("additionalContext" in o ? o.additionalContext : undefined))
    .filter((c): c is string => c !== undefined);
  const joined = contexts.length > 0 ? contexts.join("\n") : undefined;

  if (winner) {
    const output: PreToolUseHookOutput =
      joined !== undefined
        ? { hookEventName: "PreToolUse", ...winner, additionalContext: joined }
        : { hookEventName: "PreToolUse", ...winner };
    return { hookSpecificOutput: output };
  }
  if (joined !== undefined) {
    return { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: joined } };
  }
  return {};
}

/**
 * permissionDecision を持つルールから最も制限的なものを選ぶ
 */
function mostRestrictive(outputs: PreToolUseDecision[]): DecidedOutput | undefined {
  const decided = outputs.filter((o): o is DecidedOutput => "permissionDecision" in o);

  return decided.reduce<DecidedOutput | undefined>((best, cur) => {
    if (!best) return cur;
    return DECISION_RANK[cur.permissionDecision] < DECISION_RANK[best.permissionDecision]
      ? cur
      : best;
  }, undefined);
}
