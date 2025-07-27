#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { loadConfig } from "./config";
import { main } from "./main";
import type { HookConfig } from "./types/userConfig";
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
 * ■ テスト（開発時の動作確認）
 *   - ファイルから: bunx @miyaoka/claude-hooks test-input.json
 *   - 組み込みデータ: bunx @miyaoka/claude-hooks --test
 */

// 設定を読み込む前に引数をパースする必要があるので、この部分は後で処理する

async function readStdin(): Promise<string | null> {
  // 標準入力がTTY（端末）の場合、またはisTTYがundefinedの場合は、パイプされていない
  if (process.stdin.isTTY !== false) {
    return null;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString();
}

// コマンドライン引数をパース
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    debug: { type: "boolean", short: "d" },
    help: { type: "boolean", short: "h" },
    input: { type: "string", short: "i" },
    config: { type: "string", short: "c" },
  } as const,
  strict: true,
  allowPositionals: false,
});

// ヘルプ表示
if (values.help) {
  const helpText = await Bun.file(
    new URL("./messages/help.txt", import.meta.url).pathname,
  ).text();
  console.log(helpText);
  process.exit(0);
}

// デバッグモードを初期化（環境変数とCLI引数を考慮）
initDebugMode(values.debug ?? false);

// 入力を取得
let input: string;

// 標準入力があるかチェック
const stdinInput = await readStdin();

if (stdinInput !== null) {
  // 標準入力がある場合（本番環境）
  input = stdinInput;
} else if (values.input) {
  // --inputが指定された場合
  if (values.input === "-") {
    // 明示的に標準入力を指定
    console.error(
      "No input provided via stdin. Use --help for usage information.",
    );
    process.exit(1);
  }
  const inputResult = await tryCatchAsync(() => {
    if (!values.input) {
      throw new Error("Input file path is undefined");
    }
    return Bun.file(values.input).text();
  });
  if (!inputResult.value) {
    console.error(`Error reading input file: ${values.input}`);
    console.error(inputResult.error);
    process.exit(1);
  }
  input = inputResult.value;
  console.log(`Input file: ${values.input}`);
  console.log(input);
} else {
  // デフォルトのサンプル入力を使用
  const defaultInputPath = new URL("../examples/input.json", import.meta.url)
    .pathname;
  const defaultInputResult = await tryCatchAsync(() =>
    Bun.file(defaultInputPath).text(),
  );
  if (!defaultInputResult.value) {
    console.error(`Error reading default input file: ${defaultInputPath}`);
    console.error(
      `Please ensure the file exists or provide input via --input option`,
    );
    process.exit(1);
  }
  input = defaultInputResult.value;
  console.log(`Using default input: ${defaultInputPath}`);
  console.log(input);
}

// 設定ファイルを読み込む
let config: HookConfig;
if (values.config) {
  // --configが指定された場合
  const configResult = await tryCatchAsync(async () => {
    if (!values.config) {
      throw new Error("Config file path is undefined");
    }
    const configContent = await Bun.file(values.config).text();
    console.log(`Config file: ${values.config}`);
    console.log(configContent);
    return JSON.parse(configContent);
  });
  if (!configResult.value) {
    console.error(`Error reading config file: ${values.config}`);
    console.error(configResult.error);
    process.exit(1);
  }
  config = configResult.value;
} else {
  // デフォルトの設定読み込み
  config = loadConfig(process.cwd());
  if (config.length === 0) {
    const noConfigError = await Bun.file(
      new URL("./messages/no-config-error.txt", import.meta.url).pathname,
    ).text();
    console.error(noConfigError);
    process.exit(1);
  }
}

// メイン関数を実行
const mainResult = await tryCatchAsync(() => main(input, config));
if (!mainResult.value) {
  console.error("Error:", mainResult.error);
  process.exit(1);
}
