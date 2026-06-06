import { checkBashCommand } from "./bash";
import { debugLog } from "./cli";
import { tryCatch } from "./result";
import type {
  BashHookInput,
  HookConfig,
  HookInput,
  HookResponse,
} from "./types";

export async function main(input: string, config: HookConfig): Promise<void> {
  await debugLog(`Raw input: ${input}`);

  const parseResult = tryCatch(() => JSON.parse(input));
  if (!parseResult.value) {
    await debugLog(`Parse error: ${parseResult.error}`);
    console.error("Invalid JSON input");
    process.exit(1);
  }

  const parsed = parseResult.value;
  if (!validateHookInput(parsed)) {
    await debugLog("Validation error: Invalid hook input");
    console.error("Invalid hook input");
    process.exit(1);
  }

  const response = dispatch(parsed, config);
  console.log(JSON.stringify(response));
  process.exit(0);
}

/**
 * PreToolUse Bash 以外の hook event / tool もこのスクリプトに届き得る。
 * ここでは共通フィールドだけ検証し、dispatch で PreToolUse + Bash 以外は素通しする
 */
function validateHookInput(input: unknown): input is HookInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const i = input as Record<string, unknown>;
  return (
    typeof i.session_id === "string" &&
    typeof i.transcript_path === "string" &&
    typeof i.cwd === "string" &&
    typeof i.hook_event_name === "string"
  );
}

/**
 * PreToolUse + Bash のみ checkBashCommand に流す。
 * それ以外の hook event / tool は空レスポンス `{}` で素通し。
 * PreToolUse + Bash で tool_input の形が壊れていたら Claude Code 側のスキーマ違反として exit(1)
 */
function dispatch(input: HookInput, config: HookConfig): HookResponse {
  if (input.hook_event_name !== "PreToolUse") return {};
  if (input.tool_name !== "Bash") return {};

  if (typeof input.tool_input !== "object" || input.tool_input === null) {
    console.error("Invalid Bash hook input: tool_input must be an object");
    process.exit(1);
  }
  const command = (input.tool_input as { command?: unknown }).command;
  if (typeof command !== "string") {
    console.error(
      "Invalid Bash hook input: tool_input.command must be a string",
    );
    process.exit(1);
  }

  return checkBashCommand(input as BashHookInput, config);
}
