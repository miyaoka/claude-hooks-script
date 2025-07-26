import type { BaseHookResponse } from "./base";

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
}

export interface PreCompactResponse extends BaseHookResponse {
  decision?: "block";
  reason?: string;
}

export type HookResponse =
  | PreToolUseResponse
  | PostToolUseResponse
  | NotificationResponse
  | StopResponse
  | SubagentStopResponse
  | UserPromptSubmitResponse
  | PreCompactResponse;
