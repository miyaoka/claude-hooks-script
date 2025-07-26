// Hook入力の型定義（実際のClaude hooksの仕様に基づく）
export interface BaseHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
}

// ツール名の型定義
export type ToolName =
  | "Bash"
  | "Read"
  | "Write"
  | "Edit"
  | "MultiEdit"
  | "Glob"
  | "Grep"
  | "LS"
  | "WebFetch"
  | "WebSearch"
  | "TodoWrite"
  | "NotebookRead"
  | "NotebookEdit"
  | "Task"
  | "ExitPlanMode"
  | string; // MCPツールや将来の拡張のため

export interface PreToolUseInput extends BaseHookInput {
  hook_event_name: "PreToolUse";
  tool_name: ToolName;
  tool_input: Record<string, unknown>;
}

export interface PostToolUseInput extends BaseHookInput {
  hook_event_name: "PostToolUse";
  tool_name: ToolName;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
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

export interface UserPromptSubmitInput extends BaseHookInput {
  hook_event_name: "UserPromptSubmit";
  prompt: string;
}

export interface PreCompactInput extends BaseHookInput {
  hook_event_name: "PreCompact";
}

export type HookInput =
  | PreToolUseInput
  | PostToolUseInput
  | NotificationInput
  | StopInput
  | SubagentStopInput
  | UserPromptSubmitInput
  | PreCompactInput;

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

export interface UserPromptSubmitResponse extends BaseHookResponse {
  decision?: "block";
  reason?: string;
  hookSpecificOutput?: {
    hookEventName: "UserPromptSubmit";
    additionalContext?: string;
  };
}

export interface PreCompactResponse extends BaseHookResponse {
  // 特別なdecisionフィールドはない
}

export type HookResponse =
  | PreToolUseResponse
  | PostToolUseResponse
  | StopResponse
  | SubagentStopResponse
  | NotificationResponse
  | UserPromptSubmitResponse
  | PreCompactResponse;
