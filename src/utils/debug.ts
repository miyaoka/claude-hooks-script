import { appendFile } from "node:fs/promises";

// デバッグモードのグローバル状態
let debugMode = false;
let debugLogPath = "/tmp/claude-hooks-debug.log";

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function isDebugMode(): boolean {
  return debugMode;
}

// 環境変数とCLI引数の両方を考慮してデバッグモードを初期化
export function initDebugMode(cliDebug?: string | boolean): void {
  const envDebug = process.env.CLAUDE_HOOK_DEBUG === "true";

  if (cliDebug === true) {
    // -d のみ指定された場合
    debugMode = true;
    // デフォルトのログファイルパスを使用
  } else if (typeof cliDebug === "string") {
    // -d <file> で指定された場合
    debugMode = true;
    debugLogPath = cliDebug;
  } else {
    // 環境変数のみをチェック
    debugMode = envDebug;
  }
}

export async function debugLog(message: string): Promise<void> {
  if (!debugMode) return;

  const timestamp = new Date().toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const logLine = `[${timestamp}] ${message}\n`;
  await appendFile(debugLogPath, logLine);
}
