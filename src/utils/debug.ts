import { appendFile } from "node:fs/promises";

// デバッグモードのグローバル状態
let debugMode = false;
// -d のみの場合はデフォルトのログファイルパスを使用
let debugLogPath = "/tmp/claude-hooks-debug.log";

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function isDebugMode(): boolean {
  return debugMode;
}

// CLI引数でデバッグモードを初期化
export function initDebugMode(cliDebug: string | boolean): void {
  debugMode = true;

  // -d <file> で指定された場合
  if (typeof cliDebug === "string") {
    debugLogPath = cliDebug;
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
