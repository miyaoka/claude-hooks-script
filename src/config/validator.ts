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
      // 他のツールも許可する（将来の拡張性のため）
      break;
  }

  return true;
}

/**
 * HookConfigの型ガード
 */
export function validateConfig(config: unknown): config is HookConfig {
  if (!Array.isArray(config)) {
    console.error("Config validation error: Config must be an array");
    return false;
  }

  let hasErrors = false;

  // 各ルールの検証
  for (let i = 0; i < config.length; i++) {
    const rule = config[i];
    if (!isPreToolUseRule(rule)) {
      console.error(
        `Config validation error: Invalid rule at index ${i}:`,
        rule,
      );
      hasErrors = true;
    }
  }

  return !hasErrors;
}
