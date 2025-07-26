import { processHook } from "./hook-handler";
import type { HookInput } from "./types";
import { debugLog, dumpToTmp } from "./utils/debug";

export async function main(input: string): Promise<void> {
  try {
    if (!input) {
      await debugLog("No input received");
      process.exit(0);
    }

    await debugLog(`Raw input: ${input}`);

    const hookInput = JSON.parse(input) as HookInput;

    // デバッグ: 入力を/tmpにダンプ
    await dumpToTmp(hookInput);

    // TODO: 実際のhook処理を実装
    await processHook(hookInput);

    // 現在は成功を返すだけ
    process.exit(0);
  } catch (error) {
    await debugLog(`Error: ${error}`);
    console.error("Error processing hook:", error);
    process.exit(1);
  }
}
