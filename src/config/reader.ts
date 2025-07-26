import { readFileSync } from "node:fs";
import type { HookConfig } from "../types/userConfig";
import { validateConfig } from "./validator";

/**
 * 設定ファイルを読み込んで解析する
 * @param path 設定ファイルのパス
 * @returns 解析された設定、またはエラーの場合はundefined
 */
export function readConfig(path: string): HookConfig | undefined {
  try {
    const content = readFileSync(path, "utf-8");
    const parsed = JSON.parse(content);

    // 型検証
    if (validateConfig(parsed)) {
      return parsed;
    }

    // 検証失敗時はundefinedを返す
    console.error(`Config validation failed for ${path}`);
    return undefined;
  } catch (error) {
    // ファイル読み込みエラーまたはJSON解析エラー
    console.error(`Config read error for ${path}: ${error}`);
    return undefined;
  }
}

/**
 * 複数の設定ファイルパスから設定を読み込む
 * @param paths 設定ファイルパスの配列
 * @returns 読み込まれた設定の配列
 */
export function readConfigs(paths: string[]): HookConfig[] {
  const configs: HookConfig[] = [];

  for (const path of paths) {
    const config = readConfig(path);
    if (config) {
      configs.push(config);
    }
  }

  return configs;
}
