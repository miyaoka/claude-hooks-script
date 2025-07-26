import { processHook } from "./core/hookInputHandler";
import { validateHookInput } from "./core/hookInputValidator";
import type { HookConfig } from "./types/userConfig";
import { debugLog } from "./utils/debug";
import { tryCatch } from "./utils/result";

export async function main(input: string, config: HookConfig): Promise<void> {
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

  // hook処理を実行
  const result = await processHook(parsedInput, config);

  // 結果を標準出力に出力してclaudeに伝える
  console.log(JSON.stringify(result));

  // 成功を返す
  process.exit(0);
}
