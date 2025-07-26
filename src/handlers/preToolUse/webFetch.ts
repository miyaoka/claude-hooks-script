import type {
  PreToolUseResponse,
  WebFetchPreToolUseInput,
} from "../../types/hook";
import { tryCatch } from "../../utils/result";
import type { MatchedRule, WebFetchRule } from "../preToolUse";
import { selectMostRestrictiveRule } from "./utils";

/**
 * WebFetchツール専用のハンドラー
 * URLのドメインに基づいてフェッチを許可/ブロックする
 *
 * 処理フロー：
 * 1. ルールの正規化（同じdomain条件は後のもので上書き）
 * 2. ルールのマッチング（特定ルール優先、なければデフォルト）
 * 3. 最も制限的なルールを選択
 */
export function handleWebFetchTool(
  input: WebFetchPreToolUseInput,
  rules: WebFetchRule[],
): PreToolUseResponse {
  if (rules.length === 0) {
    return {};
  }

  // 1. ルールの正規化（同じdomainを持つルールは後のもので上書き）
  const normalizedRules = normalizeWebFetchRules(rules);

  // tool_inputからURLを取得
  const url = input.tool_input.url;
  if (!url) {
    return {};
  }

  // URLのホスト名を取得
  const urlResult = tryCatch(() => new URL(url));
  if (!urlResult.value) {
    return {};
  }
  const hostname = urlResult.value.hostname;

  // 2. ルールのマッチング
  const matchedRules: MatchedRule[] = [];

  // 特定条件（domainあり）のマッチング
  const specificRules = matchSpecificRules(normalizedRules, hostname);

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
 * WebFetch用のルール正規化
 * 同じdomainを持つルールは最後のもので上書き
 */
function normalizeWebFetchRules(rules: WebFetchRule[]): WebFetchRule[] {
  const seen = new Set<string>();
  const result: WebFetchRule[] = [];

  // 重複するキーは配列の後方のものを優先するため、逆順に走査して初出のもののみ採用
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (!rule) continue;

    const key = rule.domain || "";

    // 既に同じキーが存在する場合はスキップして採用しない
    if (seen.has(key)) continue;

    seen.add(key);
    result.unshift(rule); // 先頭に追加して元の順序を保つ
  }

  return result;
}

/**
 * デフォルトルール（domainなし）のマッチング
 * domainを持たないルールは最後のもので上書きされる
 */
function matchDefaultRules(rules: WebFetchRule[]): MatchedRule[] {
  if (!rules) return [];

  const defaultRules = new Map<string, MatchedRule>();

  rules.forEach((rule) => {
    if (!rule.domain) {
      defaultRules.set("default", {
        decision: rule.decision,
        reason: rule.reason,
      });
    }
  });

  return Array.from(defaultRules.values());
}

/**
 * 特定条件ルール（domainあり）のマッチング
 * domainパターンにマッチするすべてのルールを返す
 */
function matchSpecificRules(
  rules: WebFetchRule[],
  hostname: string,
): MatchedRule[] {
  if (!rules) return [];

  const matchedRules: MatchedRule[] = [];

  rules.forEach((rule) => {
    if (!rule.domain) return;

    const domain = rule.domain;
    const regexResult = tryCatch(() => new RegExp(domain));

    if (regexResult.value) {
      if (regexResult.value.test(hostname)) {
        matchedRules.push({
          decision: rule.decision,
          reason: rule.reason,
        });
      }
    } else {
      // 無効な正規表現の場合は文字列として比較
      if (hostname.includes(domain)) {
        matchedRules.push({
          decision: rule.decision,
          reason: rule.reason,
        });
      }
    }
  });

  return matchedRules;
}
