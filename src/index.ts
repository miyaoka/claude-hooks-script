#!/usr/bin/env bun

import { processHook } from "./hook-handler";
import type { HookInput } from "./types";
import { appendFile } from "node:fs/promises";

async function main() {
  try {
    await debugLog("Hook script started");
    
    // 標準入力からJSONを読み取る
    const input = await readStdin();
    await debugLog(`Raw input: ${input}`);
    
    if (!input) {
      await debugLog("No input received");
      process.exit(0);
    }
    
    const hookInput = JSON.parse(input) as HookInput;
    
    // デバッグ: 入力を/tmpにダンプ
    await dumpToTmp(hookInput);
    
    // TODO: 実際のhook処理を実装
    // const response = await processHook(hookInput);
    
    // 現在は成功を返すだけ
    process.exit(0);
  } catch (error) {
    await debugLog(`Error: ${error}`);
    console.error("Error processing hook:", error);
    process.exit(1);
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks).toString();
}

async function dumpToTmp(input: HookInput): Promise<void> {
  const filename = `/tmp/claude-hook-dump.jsonl`;
  const jsonLine = JSON.stringify(input) + '\n';
  
  // Node.jsのfsモジュールを使って追記
  await appendFile(filename, jsonLine);
  
  console.error(`Appended to: ${filename}`);
}

async function debugLog(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  await appendFile("/tmp/claude-hook-debug.log", logLine);
}

// メイン関数を実行
main();