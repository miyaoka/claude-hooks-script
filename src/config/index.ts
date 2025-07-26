import { existsSync } from "node:fs";
import type { HookConfig } from "../types/userConfig";
import { resolveProjectConfigPath, resolveUserConfigPath } from "./paths";
import { readConfig } from "./reader";

/**
 * 設定を読み込んでマージする
 * @param projectRoot プロジェクトルートディレクトリ
 * @returns マージされた設定
 */
export function loadConfig(projectRoot: string): HookConfig {
  const configs: HookConfig[] = [];

  // ユーザー設定を読み込む
  const userConfigPath = resolveUserConfigPath();
  if (userConfigPath) {
    const userConfig = readConfig(userConfigPath);
    if (userConfig) {
      configs.push(userConfig);
    }
  }

  // プロジェクト設定を読み込む
  const projectConfigPath = resolveProjectConfigPath(projectRoot);
  if (existsSync(projectConfigPath)) {
    const projectConfig = readConfig(projectConfigPath);
    if (projectConfig) {
      configs.push(projectConfig);
    }
  }

  // 配列をフラットに結合
  return configs.flat();
}
