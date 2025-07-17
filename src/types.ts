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
export interface BaseHookResponse {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
}

export interface PreToolUseResponse extends BaseHookResponse {
  decision?: "approve" | "block";
  reason?: string;
}

export interface PostToolUseResponse extends BaseHookResponse {
  decision?: "block";
  reason?: string;
}

export interface StopResponse extends BaseHookResponse {
  decision?: "block";
  reason: string; // blockの場合は必須
}

export interface SubagentStopResponse extends BaseHookResponse {
  decision?: "block";
  reason: string; // blockの場合は必須
}

export interface NotificationResponse extends BaseHookResponse {
  // 特別なdecisionフィールドはない
}

export interface PreCompactResponse extends BaseHookResponse {
  // 特別なdecisionフィールドはない
}

export type HookResponse = PreToolUseResponse | PostToolUseResponse | StopResponse | SubagentStopResponse | NotificationResponse | PreCompactResponse;