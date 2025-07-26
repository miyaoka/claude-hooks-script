import type { BaseHookInput } from "./base";

// PostToolUse入力型
export interface PostToolUseInput extends BaseHookInput {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
}

// Notification入力型
export interface NotificationInput extends BaseHookInput {
  hook_event_name: "Notification";
  message: string;
}

// Stop入力型
export interface StopInput extends BaseHookInput {
  hook_event_name: "Stop";
  stop_hook_active: boolean;
}

// SubagentStop入力型
export interface SubagentStopInput extends BaseHookInput {
  hook_event_name: "SubagentStop";
}

// UserPromptSubmit入力型
export interface UserPromptSubmitInput extends BaseHookInput {
  hook_event_name: "UserPromptSubmit";
  prompt: string;
}

// PreCompact入力型
export interface PreCompactInput extends BaseHookInput {
  hook_event_name: "PreCompact";
}
