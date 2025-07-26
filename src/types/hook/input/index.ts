// 基本型のエクスポート
export type { BaseHookInput } from "./base";
// その他の入力型のエクスポート
export type {
  NotificationInput,
  PostToolUseInput,
  PreCompactInput,
  StopInput,
  SubagentStopInput,
  UserPromptSubmitInput,
} from "./other";
// PreToolUse関連のエクスポート
export type {
  BashPreToolUseInput,
  EditPreToolUseInput,
  ExitPlanModePreToolUseInput,
  GlobPreToolUseInput,
  GrepPreToolUseInput,
  LSPreToolUseInput,
  MCPPreToolUseInput,
  MultiEditPreToolUseInput,
  NotebookEditPreToolUseInput,
  NotebookReadPreToolUseInput,
  PreToolUseInput,
  ReadPreToolUseInput,
  TaskPreToolUseInput,
  TodoWritePreToolUseInput,
  WebFetchPreToolUseInput,
  WebSearchPreToolUseInput,
  WritePreToolUseInput,
} from "./preToolUse";

import type {
  NotificationInput,
  PostToolUseInput,
  PreCompactInput,
  StopInput,
  SubagentStopInput,
  UserPromptSubmitInput,
} from "./other";
// すべてのHook入力型のユニオン
import type { PreToolUseInput } from "./preToolUse";

export type HookInput =
  | PreToolUseInput
  | PostToolUseInput
  | NotificationInput
  | StopInput
  | SubagentStopInput
  | UserPromptSubmitInput
  | PreCompactInput;
