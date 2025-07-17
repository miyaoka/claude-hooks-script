// Hook入力の型定義（実際のClaude hooksの仕様に基づく）
export interface BaseHookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
}

export interface PreToolUseInput extends BaseHookInput {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: Record<string, any>;
}

export interface PostToolUseInput extends BaseHookInput {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: Record<string, any>;
  tool_response: any;
}

export interface NotificationInput extends BaseHookInput {
  hook_event_name: "Notification";
  message: string;
}

export interface StopInput extends BaseHookInput {
  hook_event_name: "Stop";
  stop_hook_active: boolean;
}

export interface SubagentStopInput extends BaseHookInput {
  hook_event_name: "SubagentStop";
}

export interface PreCompactInput extends BaseHookInput {
  hook_event_name: "PreCompact";
}

export type HookInput = PreToolUseInput | PostToolUseInput | NotificationInput | StopInput | SubagentStopInput | PreCompactInput;

// Hook応答の型定義
export interface HookResponse {
  action?: "allow" | "block";
  message?: string;
  modifications?: Record<string, any>;
}