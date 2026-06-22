// ============================================================
// 公式 PreToolUse レスポンス型（hookSpecificOutput）
// https://code.claude.com/docs/en/hooks#pretooluse-decision-control
//
// permissionDecision で判別する discriminated union。
// 公式の制約（deny/ask は reason 必須、allow/defer は reason 非表示、
// updatedInput は allow の例にのみ登場）を型レベルで表現し、
// 不正な組み合わせ（allow + reason 等）を表現不能にする。
// ============================================================

export type PermissionDecision = "allow" | "deny" | "ask" | "defer";

// allow: ツールを許可。実行前の入力差し替え（updatedInput）と文脈注入を伴える。reason は非表示なので持たない
type AllowDecision = {
  permissionDecision: "allow";
  updatedInput?: { command: string };
  additionalContext?: string;
};

// deny: ツールをブロック。reason は Claude に表示されるため必須
type DenyDecision = {
  permissionDecision: "deny";
  permissionDecisionReason: string;
  additionalContext?: string;
};

// ask: ユーザーにダイアログでエスカレーション。reason はユーザーに表示されるため必須
type AskDecision = {
  permissionDecision: "ask";
  permissionDecisionReason: string;
  additionalContext?: string;
};

// defer: 通常の権限フローに委譲（判定しない）。reason は非表示なので持たない
type DeferDecision = {
  permissionDecision: "defer";
  additionalContext?: string;
};

// permissionDecision なし: 判定せず文脈のみ注入
type ContextOnly = {
  additionalContext: string;
};

/** 公式レスポンスの中身（hookEventName を除いた決定ペイロード） */
export type PreToolUseDecision =
  | AllowDecision
  | DenyDecision
  | AskDecision
  | DeferDecision
  | ContextOnly;

/** 公式レスポンス本体 */
export type PreToolUseHookOutput = { hookEventName: "PreToolUse" } & PreToolUseDecision;

/** permissionDecision を持つ決定（ContextOnly を除く） */
export type DecidedOutput = Extract<PreToolUseDecision, { permissionDecision: PermissionDecision }>;

// ============================================================
// このリポジトリ独自部分
// ============================================================

/**
 * command にこの値を指定すると、コマンド分割後の args ではなく
 * 分割前の生のコマンド文字列全体に args パターンを照合する
 */
export const WILDCARD_COMMAND = "*";

/** 本リポジトリが公式に足す唯一の要素: マッチパターン */
export type MatchPattern = {
  command: string;
  args?: string;
};

/** 設定ルール = マッチパターン + 公式レスポンス（hookEventName 除く）の素通し */
export type BashRule = MatchPattern & PreToolUseDecision;

export type HookConfig = BashRule[];

// ============================================================
// hook 入出力
// ============================================================

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
  hookSpecificOutput?: PreToolUseHookOutput;
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
};
