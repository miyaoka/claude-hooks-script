#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { loadConfig } from "./config";
import { main } from "./main";
import { initDebugMode } from "./utils/debug";

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

// 最初に設定を読み込む
const config = loadConfig(process.cwd());
if (config.length === 0) {
  console.error("Error: No valid configuration found");
  process.exit(1);
}

async function readStdin(): Promise<string | null> {
  // 標準入力がTTY（端末）の場合は、パイプされていない
  if (process.stdin.isTTY) {
    return null;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString();
}

// コマンドライン引数をパース
const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    debug: { type: "boolean", short: "d" },
    help: { type: "boolean", short: "h" },
    test: { type: "boolean", short: "t" },
  } as const,
  strict: true,
  allowPositionals: true,
});

// ヘルプ表示
if (values.help) {
  console.log(`Usage: bunx @miyaoka/claude-hooks [options] [json-file]

Options:
  -d, --debug  Enable debug mode
  -t, --test   Run test mode with sample input
  -h, --help   Show help

Examples:
  # Claude Codeがhookとして呼び出す（本番環境、パイプ経由）
  echo '{"type": "PreToolUse", ...}' | bunx @miyaoka/claude-hooks
  
  # 開発確認用：ファイル直接指定
  bunx @miyaoka/claude-hooks test-input.json
  
  # 開発確認用：テストモード
  bunx @miyaoka/claude-hooks --test`);
  process.exit(0);
}

// デバッグモードを初期化（環境変数とCLI引数を考慮）
initDebugMode(values.debug ?? false);

// テストモード
if (values.test) {
  const testInput = JSON.stringify(
    {
      session_id: "test-session",
      transcript_path: "/tmp/test-transcript.json",
      cwd: process.cwd(),
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "echo 'hello' && cd ../../ && rm -rf ~/",
      },
    },
    null,
    2,
  );
  console.log("TestInput:", testInput);

  await main(testInput, config);
  process.exit(0);
}

// ファイルから読み込み
if (positionals.length > 0) {
  const filePath = positionals[0];
  if (!filePath) {
    console.error("File path is required");
    process.exit(1);
  }
  try {
    const fileContent = await Bun.file(filePath).text();
    await main(fileContent, config);
  } catch (error) {
    console.error(`Error reading file: ${filePath}`);
    console.error(error);
    process.exit(1);
  }
  process.exit(0);
}

// 標準入力から読み取る必要がある場合のみ読み取る
// （help/test/fileのいずれも該当しない場合）
try {
  const input = await readStdin();

  if (input === null) {
    console.error("No input provided. Use --help for usage information.");
    process.exit(1);
  }

  // メイン関数を実行
  await main(input, config);
} catch (error) {
  console.error("Error:", error);
  process.exit(1);
}
