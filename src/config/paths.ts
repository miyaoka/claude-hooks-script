import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * ユーザー設定ファイルのパスを解決する
 * 優先順位:
 * 1. $CLAUDE_CONFIG_DIR/hooks.config.json
 * 2. $HOME/.config/claude/hooks.config.json
 * 3. $HOME/.claude/hooks.config.json
 *
 * 最初に見つかったパスを返す
 */
const configFileName = "hooks.config.json";
export function resolveUserConfigPath(): string | undefined {
  const home = homedir();

  // 1. $CLAUDE_CONFIG_DIR
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
  if (claudeConfigDir) {
    const path = join(claudeConfigDir, configFileName);
    if (existsSync(path)) {
      return path;
    }
  }

  // 2. $HOME/.config/claude
  const xdgConfigPath = join(home, ".config", "claude", configFileName);
  if (existsSync(xdgConfigPath)) {
    return xdgConfigPath;
  }

  // 3. $HOME/.claude
  const legacyConfigPath = join(home, ".claude", configFileName);
  if (existsSync(legacyConfigPath)) {
    return legacyConfigPath;
  }

  return undefined;
}

/**
 * プロジェクト設定ファイルのパスを解決する
 */
export function resolveProjectConfigPath(projectRoot: string): string {
  return join(projectRoot, ".claude", configFileName);
}
