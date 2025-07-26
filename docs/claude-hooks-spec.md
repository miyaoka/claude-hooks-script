# Claude Hooks 仕様

公式ドキュメントの内容写し

https://docs.anthropic.com/en/docs/claude-code/hooks

## 概要

Claude hooks は、Claude Code のツール使用をインターセプトし、カスタムロジックを追加できる機能

## 設定ファイル

`~/.claude/settings.json` または `.claude/settings.json` に記述

### 基本構造

```json
{
  "hooks": {
    "EventName": [
      {
        "tool": "ToolPattern",
        "hooks": [
          {
            "type": "command",
            "command": "your-command-here",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### パラメータ

- `tool`: ツール名のパターン（大文字小文字を区別）
  - 完全一致: `"Write"`
  - 正規表現: `"Edit|Write"` または `"Notebook.*"`
  - 空文字列または省略: すべてのイベントにマッチ
- `type`: 現在は `"command"` のみサポート
- `command`: 実行する Bash コマンド
- `timeout`(optional): 最大実行時間（秒）

## Hook Events

### PreToolUse

ツール実行前に呼ばれる。ツールの実行を許可/拒否できる

### PostToolUse

ツール実行後に呼ばれる。結果のログ記録などに使用

### Notification

Claude が通知を送信するときに呼ばれる

### Stop

メインエージェントが終了するときに呼ばれる

### SubagentStop

サブエージェントが終了するときに呼ばれる

### UserPromptSubmit

ユーザーのプロンプトが送信されたときに呼ばれる。プロンプトの検証や事前処理に使用

### PreCompact

コンテキスト圧縮前に呼ばれる

## Hook 入力形式

hook スクリプトは標準入力から JSON を受け取る：

### 共通フィールド

```ts
{
  // Common fields
  session_id: string,
  transcript_path: string,   // Path to conversation JSON
  cwd: string,              // The current working directory when the hook is invoked

  // Event-specific fields
  hook_event_name: string
  ...
}
```

### PreToolUse

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  }
}
```

### PostToolUse

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  },
  "tool_response": {
    "filePath": "/path/to/file.txt",
    "success": true
  }
}
```

### Notification

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "Notification",
  "message": "Task completed successfully"
}
```

### UserPromptSubmit

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Help me write a function to calculate factorial"
}
```

### Stop / SubagentStop

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "Stop",
  "stop_hook_active": true
}
```

## Hook 応答

### 終了コード

- `0`: 成功（ブロックしない）
- `2`: ブロッキングエラー（ツール使用を阻止）
- その他: 非ブロッキングエラー

### JSON 応答

標準出力に出力し、メインエージェントに制御メッセージを伝える

#### 共通フィールド

```ts
{
  continue: boolean, // デフォルト true。false で Claude 全体の処理を停止
  stopReason: string, // `continue`が false の時の理由（ユーザーに表示、Claude には非表示）
  suppressOutput: boolean, // デフォルト false。true で stdout をトランスクリプトから隠す
}
```

#### PreToolUse

```ts
{
  decision?: "approve" | "block",
  reason: "判定の理由"
}
```

- `decision`:
  - `"approve"`: 権限システムをバイパスしてツール使用を許可
  - `"block"`: ツール使用をブロック
  - `undefined`: デフォルトの権限フローを使用
- `reason`: decision の理由（Claude に表示）

#### PostToolUse

```ts
{
  decision?: "block",
  reason: "ブロックの理由"
}
```

- `decision`:
  - `"block"`: reason を Claude にプロンプトとして表示
  - `undefined`: 通常処理

#### Stop / SubagentStop

```ts
{
  decision?: "block",
  "reason": "続行方法の説明（必須）"
}
```

- `decision`:
  - `"block"`: Claude の停止を阻止
  - `undefined`: 通常の停止処理
- `reason`: block の場合、Claude に続行方法を説明（必須）

#### UserPromptSubmit

```ts
{
  decision?: "block",
  reason?: "ブロックの理由",
  hookSpecificOutput?: {
    hookEventName: "UserPromptSubmit",
    additionalContext?: "プロンプトに追加するコンテキスト"
  }
}
```

- `decision`:
  - `"block"`: プロンプトの処理をブロック
  - `undefined`: 通常処理
- `reason`: block の場合の理由（ユーザーに表示）
- `hookSpecificOutput.additionalContext`: プロンプトに追加するコンテキスト（block しない場合のみ有効）

#### PreCompact / Notification

特別な decision フィールドはない
