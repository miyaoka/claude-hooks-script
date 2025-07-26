import { handlePreToolUse } from "../handlers";
import type { HookInput, HookResponse } from "../types/hook";
import type { HookConfig } from "../types/userConfig";

// PreToolUseのみを処理
export const processHook = async (
  input: HookInput,
  config: HookConfig,
): Promise<HookResponse> => {
  // イベントごとに処理を振り分け
  switch (input.hook_event_name) {
    case "PreToolUse": {
      // configから該当するルールのみを抽出
      const preToolUseRules = config.filter(
        (rule) => rule.event === "preToolUse",
      );
      return handlePreToolUse(input, preToolUseRules);
    }
    default:
      // 他のhookは現状処理しない。空のレスポンスを返す
      return {};
  }
};
