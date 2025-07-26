import type { HookInput, HookResponse } from "./types";
import { handlePreToolUse } from "./handlers";

// PreToolUseのみを処理
export const processHook = async (input: HookInput): Promise<HookResponse> => {
  if (input.hook_event_name === "PreToolUse") {
    return handlePreToolUse(input);
  }
  
  // 他のhookは空のレスポンスを返す
  return {};
};