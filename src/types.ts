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

/**
 * PreToolUse の hook 出力本体。
 * PreToolUse は top-level の decision/reason を使わず hookSpecificOutput で制御する
 * （decision/reason は UserPromptSubmit / PostToolUse / Stop 等の別イベント用）。
 * - 許可判定は permissionDecision（公式は allow/deny/ask/defer。本フックは allow/deny のみ使用、省略時は defer 相当）
 * - permissionDecision を省き additionalContext 単体で返すとブロックせずモデルへ文脈を注入する
 */
export type PreToolUseHookOutput = {
  hookEventName: "PreToolUse";
  permissionDecision?: "allow" | "deny";
  permissionDecisionReason?: string;
  additionalContext?: string;
};

export type HookResponse = {
  hookSpecificOutput?: PreToolUseHookOutput;
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
};

export type RuleResult = {
  decision: "approve" | "block" | undefined;
  reason: string;
};
