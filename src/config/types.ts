import type { PreToolUseRule } from "../handlers/preToolUse";

// 全体の設定の型定義
export interface HookConfig {
  preToolUse?: PreToolUseRule[];
}
