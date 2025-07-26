import type { PreToolUseRule } from "../handlers/preToolUse";
import type { HookConfig } from "../types/userConfig";

/**
 * PreToolUseルールの型ガード
 */
function isPreToolUseRule(rule: unknown): rule is PreToolUseRule {
  if (typeof rule !== "object" || rule === null) {
    return false;
  }

  const r = rule as Record<string, unknown>;

  // 必須フィールド
  if (
    r.event !== "preToolUse" ||
    typeof r.tool !== "string" ||
    typeof r.reason !== "string"
  ) {
    return false;
  }

  // オプションフィールド
  if (
    r.decision !== undefined &&
    r.decision !== "block" &&
    r.decision !== "approve"
  ) {
    return false;
  }

  // ツール固有のフィールド
  switch (r.tool) {
    case "Bash":
      if (r.command !== undefined && typeof r.command !== "string")
        return false;
      if (r.args !== undefined && typeof r.args !== "string") return false;
      break;
    case "WebFetch":
      if (r.domain !== undefined && typeof r.domain !== "string") return false;
      break;
    case "WebSearch":
      if (r.query !== undefined && typeof r.query !== "string") return false;
      break;
    default:
      // 未知のツールは拒否
      return false;
  }

  return true;
}

/**
 * HookConfigの型ガード
 */
export function validateConfig(config: unknown): config is HookConfig {
  if (!Array.isArray(config)) {
    return false;
  }

  // 各ルールの検証
  for (const rule of config) {
    if (!isPreToolUseRule(rule)) {
      return false;
    }
  }

  return true;
}
