import { processHook } from "./core/hookInputHandler";
import { validateHookInput } from "./core/hookInputValidator";
import { debugLog, dumpToTmp } from "./utils/debug";
import { tryCatch } from "./utils/result";

export async function main(input: string): Promise<void> {
  if (!input) {
    await debugLog("No input received");
    process.exit(0);
  }

  await debugLog(`Raw input: ${input}`);

  const parseResult = tryCatch(() => JSON.parse(input));

  if (!parseResult.value) {
    await debugLog(`Parse error: ${parseResult.error}`);
    console.error("Invalid JSON input");
    process.exit(1);
  }

  const parsedInput = parseResult.value;

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
}
