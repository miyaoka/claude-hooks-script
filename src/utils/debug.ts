import { appendFile } from "node:fs/promises";

// デバッグモードのグローバル状態
let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function isDebugMode(): boolean {
  return debugMode;
}

// 環境変数とCLI引数の両方を考慮してデバッグモードを初期化
export function initDebugMode(cliDebug: boolean): void {
  const envDebug = process.env.CLAUDE_HOOK_DEBUG === "true";
  setDebugMode(cliDebug || envDebug);
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
  await appendFile("/tmp/claude-hook-debug.log", logLine);
}
