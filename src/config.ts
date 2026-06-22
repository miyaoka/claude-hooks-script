import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { WILDCARD_COMMAND } from "./types";
import type { HookConfig } from "./types";

const CONFIG_FILE = "hooks.config.json";
const ALLOWED_RULE_KEYS = new Set([
  "command",
  "args",
  "permissionDecision",
  "permissionDecisionReason",
  "additionalContext",
  "updatedInput",
]);
const PERMISSION_DECISIONS = new Set(["allow", "deny", "ask", "defer"]);

/**
 * ユーザー設定とプロジェクト設定をマージしてロードする
 */
export function loadConfig(projectRoot: string): HookConfig {
  const paths = [resolveUserConfigPath(), resolveProjectConfigPath(projectRoot)];

  const configs: HookConfig[] = [];
  for (const path of paths) {
    if (!path || !existsSync(path)) continue;
    const config = readConfig(path);
    if (config) configs.push(config);
  }

  return configs.flat();
}

/**
 * 1ファイルから設定を読み込み検証する
 */
export function readConfig(path: string): HookConfig | undefined {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    if (validateConfig(parsed)) return parsed;
    console.error(`Config validation failed for ${path}`);
    return undefined;
  } catch (error) {
    console.error(`Config read error for ${path}: ${formatError(error)}`);
    return undefined;
  }
}

/**
 * catch で受ける unknown を表示用文字列に整える。
 * string ならそのまま、Error なら message、それ以外は最終手段で String() 変換する
 */
export function formatError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * HookConfig（BashRule配列）の型ガード
 * 未知フィールド（event / tool / domain / query 等の旧スキーマ）の混入も拒否する
 */
export function validateConfig(config: unknown): config is HookConfig {
  if (!Array.isArray(config)) {
    console.error("Config validation error: Config must be an array");
    return false;
  }

  let valid = true;
  for (let i = 0; i < config.length; i++) {
    const error = checkBashRule(config[i]);
    if (error === null) continue;
    console.error(`Config validation error at index ${i}: ${error}`, config[i]);
    valid = false;
  }
  return valid;
}

function checkBashRule(rule: unknown): string | null {
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
    return "rule must be a plain object";
  }
  const r = rule as Record<string, unknown>;

  // --- マッチパターン（このリポジトリ独自） ---
  if (typeof r.command !== "string") return "command must be a string";
  if (r.args !== undefined && typeof r.args !== "string") {
    return "args must be a string when present";
  }
  // argsなしの "*" は全コマンド無条件マッチになるため禁止
  if (r.command === WILDCARD_COMMAND && typeof r.args !== "string") {
    return 'wildcard rule (command: "*") requires args';
  }

  // 旧スキーマ（decision/reason/event/tool 等）を移行ガイドとして先に検出する
  const unknown = Object.keys(r).filter((k) => !ALLOWED_RULE_KEYS.has(k));
  if (unknown.length > 0) {
    return `unknown fields: ${unknown.join(", ")} — may be using old schema; remove decision/reason/event/tool/domain/query`;
  }

  // --- 公式レスポンスフィールド ---
  const decisionError = checkDecisionFields(r);
  if (decisionError !== null) return decisionError;

  return null;
}

/**
 * 公式レスポンスフィールドを公式の制約どおりに検証する。
 * - permissionDecision: allow / deny / ask / defer
 * - permissionDecisionReason: deny / ask で必須、allow で任意、defer / なしでは不可（defer は無視される）
 * - updatedInput: allow / ask のみ、{ command: 非空文字列 }
 * - additionalContext: 非空文字列。defer では無視されるため不可
 * - ルールは permissionDecision か additionalContext の少なくとも一方を持つ
 */
function checkDecisionFields(r: Record<string, unknown>): string | null {
  const decision = r.permissionDecision;
  if (
    decision !== undefined &&
    (typeof decision !== "string" || !PERMISSION_DECISIONS.has(decision))
  ) {
    return 'permissionDecision must be one of "allow" / "deny" / "ask" / "defer" when present';
  }

  // reason: deny / ask で必須、allow で任意、defer / なしでは不可
  const reasonAllowed = decision === "allow" || decision === "deny" || decision === "ask";
  const reasonRequired = decision === "deny" || decision === "ask";
  if (r.permissionDecisionReason !== undefined) {
    if (typeof r.permissionDecisionReason !== "string") {
      return "permissionDecisionReason must be a string";
    }
    if (r.permissionDecisionReason === "") return "permissionDecisionReason must not be empty";
    if (!reasonAllowed) {
      return 'permissionDecisionReason is only valid with permissionDecision "allow" / "deny" / "ask"';
    }
  } else if (reasonRequired) {
    return `permissionDecision "${decision}" requires permissionDecisionReason`;
  }

  // updatedInput: allow / ask のみ
  if (r.updatedInput !== undefined) {
    if (decision !== "allow" && decision !== "ask") {
      return 'updatedInput is only valid with permissionDecision "allow" or "ask"';
    }
    if (
      typeof r.updatedInput !== "object" ||
      r.updatedInput === null ||
      Array.isArray(r.updatedInput)
    ) {
      return "updatedInput must be a plain object";
    }
    const command = (r.updatedInput as Record<string, unknown>).command;
    if (typeof command !== "string" || command === "") {
      return "updatedInput.command must be a non-empty string";
    }
  }

  // additionalContext: defer では無視されるため不可
  if (r.additionalContext !== undefined) {
    if (typeof r.additionalContext !== "string") return "additionalContext must be a string";
    if (r.additionalContext === "") return "additionalContext must not be empty";
    if (decision === "defer") {
      return 'additionalContext is ignored with permissionDecision "defer"';
    }
  }

  if (decision === undefined && r.additionalContext === undefined) {
    return "rule must set permissionDecision or additionalContext";
  }

  return null;
}

/**
 * ユーザー設定ファイルの優先順位:
 * 1. $CLAUDE_CONFIG_DIR/hooks.config.json
 * 2. $HOME/.config/claude/hooks.config.json
 * 3. $HOME/.claude/hooks.config.json
 */
function resolveUserConfigPath(): string | undefined {
  const candidates: string[] = [];

  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
  if (claudeConfigDir) {
    candidates.push(join(claudeConfigDir, CONFIG_FILE));
  }

  const home = homedir();
  candidates.push(join(home, ".config", "claude", CONFIG_FILE));
  candidates.push(join(home, ".claude", CONFIG_FILE));

  return candidates.find((path) => existsSync(path));
}

function resolveProjectConfigPath(projectRoot: string): string {
  return join(projectRoot, ".claude", CONFIG_FILE);
}
