import type { PreToolUseResponse } from "../../types/hook";
import type { RuleResult } from "../preToolUse";

/**
 * 最も制限的なルールを選択
 * 優先順位: block > undefined > approve
 */
export function selectMostRestrictiveRule(
  rules: RuleResult[],
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
