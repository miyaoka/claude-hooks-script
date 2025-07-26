#!/usr/bin/env bun

import { main } from "./main";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString();
}

// 標準入力からJSONを読み取る
const input = await readStdin();

// メイン関数を実行
await main(input);