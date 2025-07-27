#!/usr/bin/env bun

import { getConfig } from "./cli/getConfig";
import { getInput } from "./cli/getInput";
import { parseArgs, showHelpAndExit } from "./cli/parseArgs";
import { main } from "./main";
import { initDebugMode } from "./utils/debug";
import { tryCatchAsync } from "./utils/result";

/**
 * Claude Code hook スクリプトのエントリーポイント
 *
 * Claude Codeがツール実行前に呼び出すhookプログラム。
 * コマンド内容に応じて実行をブロックするなど、Claudeのツール実行を制御する。
 *
 * 動作の流れ：
 * 1. 設定ファイル（hooks.config.json）からルールを読み込む
 * 2. Claude Codeからツール実行情報を受け取る
 * 3. ルールに基づいて許可/ブロックを判断
 * 4. 結果をconsole.log（JSON形式）で返してClaudeのツール実行を制御
 *
 * 実行モード：
 *
 * ■ 本番（Claude Codeから自動実行）
 *   Claude Code → パイプ → 本スクリプト
 *   例: echo '{"hook_event_name": "PreToolUse", ...}' | bunx @miyaoka/claude-hooks
 *
 * ■ 開発（動作確認）
 *   - デフォルト: bun run dev
 *   - input指定: bun run dev -i custom-input.json
 *   - config指定: bun run dev -c custom-config.json
 *  引数を付けない場合は exmaples/input.json とユーザーディレクトリのconfigが使われる
 */

// コマンドライン引数をパース
const values = parseArgs();

// ヘルプ表示
if (values.help) {
  await showHelpAndExit();
}

// デバッグモードを初期化
if (values.debug) {
  initDebugMode(values.debug);
}

// 入力を取得
const input = await getInput(values.input);

// 設定ファイルを読み込む
const config = await getConfig(values.config);

// メイン関数を実行
const mainResult = await tryCatchAsync(() => main(input, config));
if (!mainResult.value) {
  console.error("Error:", mainResult.error);
  process.exit(1);
}
