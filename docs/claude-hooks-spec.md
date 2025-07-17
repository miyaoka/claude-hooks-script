# Claude Hooks 仕様

## 概要

Claude hooksは、Claude Codeのツール使用をインターセプトし、カスタムロジックを追加できる機能

## 設定ファイル

`~/.claude/settings.json` または `.claude/settings.json` に記述

### 基本構造

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolPattern",
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

- `matcher`: ツール名のパターン（大文字小文字を区別）
  - 完全一致: `"Write"`
  - 正規表現: `"Edit|Write"` または `"Notebook.*"`
  - 空文字列または省略: すべてのイベントにマッチ
- `type`: 現在は `"command"` のみサポート
- `command`: 実行するBashコマンド
- `timeout`: 最大実行時間（秒）、オプション

## Hook Types

### PreToolUse
ツール実行前に呼ばれる。ツールの実行を許可/拒否できる

### PostToolUse
ツール実行後に呼ばれる。結果のログ記録などに使用

### Notification
Claudeが通知を送信するときに呼ばれる

### Stop
メインエージェントが終了するときに呼ばれる

### SubagentStop
サブエージェントが終了するときに呼ばれる

### PreCompact
コンテキスト圧縮前に呼ばれる

## Hook入力形式

hookスクリプトは標準入力からJSONを受け取る：

### 共通フィールド
```json
{
  "session_id": "string",
  "transcript_path": "string",
  "hook_event_name": "string"
}
```

### PreToolUse
```json
{
  "session_id": "string",
  "transcript_path": "string",
  "hook_event_name": "PreToolUse",
  "tool_name": "string",
  "tool_input": { ... }
}
```

### PostToolUse
```json
{
  "session_id": "string",
  "transcript_path": "string",
  "hook_event_name": "PostToolUse",
  "tool_name": "string",
  "tool_input": { ... },
  "tool_response": { ... }
}
```

### Notification
```json
{
  "session_id": "string",
  "transcript_path": "string",
  "hook_event_name": "Notification",
  "message": "string"
}
```

### Stop
```json
{
  "session_id": "string",
  "transcript_path": "string",
  "hook_event_name": "Stop",
  "stop_hook_active": boolean
}
```

## Hook応答

### 終了コード
- `0`: 成功（ブロックしない）
- `2`: ブロッキングエラー（ツール使用を阻止）
- その他: 非ブロッキングエラー

### JSON応答（オプション）

標準出力に出力する。

#### 共通フィールド
- `continue` (boolean): デフォルトtrue。falseでClaude全体の処理を停止
- `stopReason` (string): `continue`がfalseの時の理由（ユーザーに表示、Claudeには非表示）
- `suppressOutput` (boolean): デフォルトfalse。trueでstdoutをトランスクリプトから隠す

#### PreToolUse
```json
{
  "decision": "approve" | "block" | undefined,
  "reason": "判定の理由"
}
```
- `decision`:
  - `"approve"`: 権限システムをバイパスしてツール使用を許可
  - `"block"`: ツール使用をブロック
  - `undefined`: デフォルトの権限フローを使用
- `reason`: decisionの理由（Claudeに表示）

#### PostToolUse
```json
{
  "decision": "block" | undefined,
  "reason": "ブロックの理由"
}
```
- `decision`:
  - `"block"`: reasonをClaudeにプロンプトとして表示
  - `undefined`: 通常処理

#### Stop / SubagentStop
```json
{
  "decision": "block" | undefined,
  "reason": "続行方法の説明（必須）"
}
```
- `decision`:
  - `"block"`: Claudeの停止を阻止
  - `undefined`: 通常の停止処理
- `reason`: blockの場合、Claudeに続行方法を説明（必須）

#### PreCompact / Notification
特別なdecisionフィールドはない

## 設定例

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bunx claude-hooks"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bunx claude-hooks",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```