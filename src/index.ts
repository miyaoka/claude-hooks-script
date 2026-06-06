#!/usr/bin/env bun

import { getConfig, getInput, initDebugMode, parseArgs, showHelpAndExit } from "./cli";
import { main } from "./main";
import { tryCatchAsync } from "./result";

/**
 * Claude Code hook スクリプトのエントリーポイント
 *
 * 流れ：
 * 1. 設定ファイル（hooks.config.json）からBashルールを読み込む
 * 2. Claude Codeからツール実行情報を受け取る
 * 3. PreToolUse の Bash ならルールに基づいて許可/ブロックを判断
 * 4. 結果をJSON形式で標準出力に返す
 */

const values = parseArgs();

if (values.help) {
  await showHelpAndExit();
}

if (values.debug) {
  initDebugMode(values.debug);
}

const input = await getInput(values.input);
const config = await getConfig(values.config);

const mainResult = await tryCatchAsync(() => main(input, config));
if (!mainResult.value) {
  console.error("Error:", mainResult.error);
  process.exit(1);
}
