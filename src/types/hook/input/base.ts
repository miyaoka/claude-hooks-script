// Hook入力の基本型定義
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
