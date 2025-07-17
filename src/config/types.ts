import type { PreToolUseRule } from "../handlers/pre-tool-use";

// 全体の設定の型定義
export interface HookConfig {
  preToolUse?: PreToolUseRule[];
  // postToolUse?: PostToolUseRule[];
  // notification?: NotificationRule[];
  // stop?: StopRule[];
  // subagentStop?: SubagentStopRule[];
  // preCompact?: PreCompactRule[];
}