import { handlePreToolUse } from "../handlers";
import type { PreToolUseRule } from "../handlers/preToolUse";
import type { HookInput, HookResponse } from "../types/hook";

// PreToolUseのみを処理
export const processHook = async (input: HookInput): Promise<HookResponse> => {
  if (input.hook_event_name === "PreToolUse") {
    // TODO: 設定ファイルからルールを読み込む
    const rules: PreToolUseRule[] = [];
    return handlePreToolUse(input, rules);
  }

  // 他のhookは現状処理しない。空のレスポンスを返す
  return {};
};
