/**
 * command にこの値を指定すると、コマンド分割後の args ではなく
 * 分割前の生のコマンド文字列全体に args パターンを照合する
 */
export const WILDCARD_COMMAND = "*";

export type BashRule = {
  command: string;
  args?: string;
  decision?: "approve" | "block";
  reason: string;
};

export type HookConfig = BashRule[];

type BaseHookInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
};

export type BashHookInput = BaseHookInput & {
  hook_event_name: "PreToolUse";
  tool_name: "Bash";
  tool_input: {
    command: string;
  };
};

export type HookInput = BaseHookInput & {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
};

export type HookResponse = {
  decision?: "approve" | "block";
  reason?: string;
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
};

export type RuleResult = {
  decision: "approve" | "block" | undefined;
  reason: string;
};
