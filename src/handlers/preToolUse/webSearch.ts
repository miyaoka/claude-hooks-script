import type {
  PreToolUseResponse,
  WebSearchPreToolUseInput,
} from "../../types/hook";
import { matchPattern } from "../../utils/matcher";
import type { RuleResult, WebSearchRule } from "../preToolUse";
import { selectMostRestrictiveRule } from "./utils";

/**
 * WebSearchツール専用のハンドラー
 * 検索クエリに基づいて検索を許可/ブロックする
 *
 * 処理フロー：
 * 1. ルールの正規化（同じquery条件は後のもので上書き）
 * 2. ルールのマッチング（特定ルール優先、なければデフォルト）
 * 3. 最も制限的なルールを選択
 */
export function handleWebSearchTool(
  input: WebSearchPreToolUseInput,
  rules: WebSearchRule[],
): PreToolUseResponse {
  if (rules.length === 0) {
    return {};
  }

  // 1. ルールの正規化（同じqueryを持つルールは後のもので上書き）
  const normalizedRules = normalizeWebSearchRules(rules);

  // tool_inputからqueryを取得
  const query = input.tool_input.query;
  if (!query) {
    return {};
  }

  // 2. ルールのマッチング
  const matchedRules: RuleResult[] = [];

  // 特定条件（queryあり）のマッチング
  const specificRules = matchSpecificRules(normalizedRules, query);

  if (specificRules.length > 0) {
    // 特定ルールがマッチした場合は、それだけを使用
    matchedRules.push(...specificRules);
  } else {
    // 特定ルールがマッチしない場合のみ、デフォルト設定を使用
    const defaultRules = matchDefaultRules(normalizedRules);
    matchedRules.push(...defaultRules);
  }

  // 3. 最も制限的なルールを選択
  return selectMostRestrictiveRule(matchedRules);
}

/**
 * WebSearch用のルール正規化
 * 同じqueryを持つルールは最後のもので上書き
 */
function normalizeWebSearchRules(rules: WebSearchRule[]): WebSearchRule[] {
  const seen = new Set<string>();
  const result: WebSearchRule[] = [];

  // 重複するキーは配列の後方のものを優先するため、逆順に走査して初出のもののみ採用
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (!rule) continue;

    const key = rule.query || "";

    // 既に同じキーが存在する場合はスキップして採用しない
    if (seen.has(key)) continue;

    seen.add(key);
    result.unshift(rule); // 先頭に追加して元の順序を保つ
  }

  return result;
}

/**
 * デフォルトルール（queryなし）のマッチング
 * queryを持たないルールは最後のもので上書きされる
 */
function matchDefaultRules(rules: WebSearchRule[]): RuleResult[] {
  if (!rules) return [];

  const defaultRules = new Map<string, RuleResult>();

  rules.forEach((rule) => {
    if (!rule.query) {
      defaultRules.set("default", {
        decision: rule.decision,
        reason: rule.reason,
      });
    }
  });

  return Array.from(defaultRules.values());
}

/**
 * 特定条件ルール（queryあり）のマッチング
 * queryパターンにマッチするすべてのルールを返す
 */
function matchSpecificRules(
  rules: WebSearchRule[],
  searchQuery: string,
): RuleResult[] {
  if (!rules) return [];

  const matchedRules: RuleResult[] = [];

  rules.forEach((rule) => {
    const ruleQuery = rule.query;
    if (!ruleQuery) return;

    if (matchPattern(ruleQuery, searchQuery)) {
      matchedRules.push({
        decision: rule.decision,
        reason: rule.reason,
      });
    }
  });

  return matchedRules;
}
