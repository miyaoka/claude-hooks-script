import { processHook } from "./core/hookHandler";
import { validateHookInput } from "./core/hookInputValidator";
import { debugLog, dumpToTmp } from "./utils/debug";

export async function main(input: string): Promise<void> {
  try {
    if (!input) {
      await debugLog("No input received");
      process.exit(0);
    }

    await debugLog(`Raw input: ${input}`);

    const parsedInput = JSON.parse(input);

    // 入力の検証
    if (!validateHookInput(parsedInput)) {
      await debugLog("Validation error: Invalid hook input");
      console.error("Invalid hook input");
      process.exit(1);
    }

    const hookInput = parsedInput;

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
