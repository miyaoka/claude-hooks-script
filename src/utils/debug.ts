import { appendFile } from "node:fs/promises";
import type { HookInput } from "../types/hook";

export async function dumpToTmp(input: HookInput): Promise<void> {
  const filename = `/tmp/claude-hook-dump.jsonl`;
  const jsonLine = JSON.stringify(input) + "\n";

  // Node.jsのfsモジュールを使って追記
  await appendFile(filename, jsonLine);

  console.error(`Appended to: ${filename}`);
}

export async function debugLog(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  await appendFile("/tmp/claude-hook-debug.log", logLine);
}