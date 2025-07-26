import type { HookInput } from "../types";

/**
 * HookInput型のバリデーション関数
 */
export function validateHookInput(input: unknown): input is HookInput {
  if (!isObject(input)) {
    return false;
  }

  // 共通フィールドの検証
  if (
    !isString(input.session_id) ||
    !isString(input.transcript_path) ||
    !isString(input.cwd) ||
    !isString(input.hook_event_name)
  ) {
    return false;
  }

  // hook_event_nameに応じた検証
  switch (input.hook_event_name) {
    case "PreToolUse":
      return validatePreToolUse(input);
    case "PostToolUse":
      return validatePostToolUse(input);
    case "Notification":
      return validateNotification(input);
    case "Stop":
      return validateStop(input);
    case "SubagentStop":
      return validateSubagentStop(input);
    case "UserPromptSubmit":
      return validateUserPromptSubmit(input);
    case "PreCompact":
      return validatePreCompact(input);
    default:
      return false;
  }
}

/**
 * 型ガードヘルパー関数
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * 各Hookタイプの検証関数
 */
function validatePreToolUse(input: Record<string, unknown>): boolean {
  return isString(input.tool_name) && isObject(input.tool_input);
}

function validatePostToolUse(input: Record<string, unknown>): boolean {
  return (
    isString(input.tool_name) &&
    isObject(input.tool_input) &&
    input.tool_response !== undefined
  );
}

function validateNotification(input: Record<string, unknown>): boolean {
  return isString(input.message);
}

function validateStop(input: Record<string, unknown>): boolean {
  return isBoolean(input.stop_hook_active);
}

function validateSubagentStop(_input: Record<string, unknown>): boolean {
  // SubagentStopは追加フィールドなし
  return true;
}

function validateUserPromptSubmit(input: Record<string, unknown>): boolean {
  return isString(input.prompt);
}

function validatePreCompact(_input: Record<string, unknown>): boolean {
  // PreCompactは追加フィールドなし
  return true;
}
