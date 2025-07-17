import type { HookInput, HookResponse } from "./types";
import { 
  handlePreToolUse,
  handlePostToolUse,
  handleNotification,
  handleStop,
  handleSubagentStop,
  handlePreCompact
} from "./handlers";

// メインのルーティング関数
export const processHook = async (input: HookInput): Promise<HookResponse> => {
  switch (input.hook_event_name) {
    case "PreToolUse":
      return handlePreToolUse(input);
    case "PostToolUse":
      return handlePostToolUse(input);
    case "Notification":
      return handleNotification(input);
    case "Stop":
      return handleStop(input);
    case "SubagentStop":
      return handleSubagentStop(input);
    case "PreCompact":
      return handlePreCompact(input);
    default:
      throw new Error(`Unknown hook type: ${(input as any).hook_event_name}`);
  }
};