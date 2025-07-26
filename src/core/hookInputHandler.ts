import { handlePreToolUse } from "../handlers";
import type { PreToolUseRule } from "../handlers/preToolUse";
import type { HookInput, HookResponse } from "../types/hook";

// PreToolUseのみを処理
export const processHook = async (input: HookInput): Promise<HookResponse> => {
  // TODO: 設定ファイルからルールを読み込む
  const rules: PreToolUseRule[] = [];

  // イベントごとに処理を振り分け
  switch (input.hook_event_name) {
    case "PreToolUse":
      return handlePreToolUse(input, rules);
    default:
      // 他のhookは現状処理しない。空のレスポンスを返す
      return {};
  }
};
