import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { WILDCARD_COMMAND } from "./types";
import type { HookConfig } from "./types";

const CONFIG_FILE = "hooks.config.json";
const ALLOWED_RULE_KEYS = new Set(["command", "args", "decision", "reason"]);

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
    console.error(`Config read error for ${path}: ${error}`);
    return undefined;
  }
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

  if (typeof r.command !== "string") return "command must be a string";
  if (typeof r.reason !== "string") return "reason must be a string";
  if (r.args !== undefined && typeof r.args !== "string") {
    return "args must be a string when present";
  }
  if (r.decision !== undefined && r.decision !== "block" && r.decision !== "approve") {
    return 'decision must be "block" or "approve" when present';
  }
  // argsなしの "*" は全コマンド無条件マッチになるため禁止
  if (r.command === WILDCARD_COMMAND && typeof r.args !== "string") {
    return 'wildcard rule (command: "*") requires args';
  }

  const unknown = Object.keys(r).filter((k) => !ALLOWED_RULE_KEYS.has(k));
  if (unknown.length > 0) {
    return `unknown fields: ${unknown.join(", ")} — may be using old schema; remove event/tool/domain/query`;
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
