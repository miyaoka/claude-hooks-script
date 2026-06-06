import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { BashRule, HookConfig } from "./types";

const CONFIG_FILE = "hooks.config.json";

/**
 * ユーザー設定とプロジェクト設定をマージしてロードする
 */
export function loadConfig(projectRoot: string): HookConfig {
  const paths = [
    resolveUserConfigPath(),
    resolveProjectConfigPath(projectRoot),
  ];

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
 */
export function validateConfig(config: unknown): config is HookConfig {
  if (!Array.isArray(config)) {
    console.error("Config validation error: Config must be an array");
    return false;
  }

  let valid = true;
  for (let i = 0; i < config.length; i++) {
    if (isBashRule(config[i])) continue;
    console.error(
      `Config validation error: Invalid rule at index ${i}:`,
      config[i],
    );
    valid = false;
  }
  return valid;
}

function isBashRule(rule: unknown): rule is BashRule {
  if (typeof rule !== "object" || rule === null) return false;

  const r = rule as Record<string, unknown>;
  if (typeof r.reason !== "string") return false;
  if (r.command !== undefined && typeof r.command !== "string") return false;
  if (r.args !== undefined && typeof r.args !== "string") return false;
  if (
    r.decision !== undefined &&
    r.decision !== "block" &&
    r.decision !== "approve"
  ) {
    return false;
  }
  return true;
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
