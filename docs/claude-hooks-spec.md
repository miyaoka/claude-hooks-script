# Claude Hooks 仕様

公式ドキュメントの内容写し

https://code.claude.com/docs/en/hooks

## 概要

Claude hooks は、Claude Code のツール使用やライフサイクルイベントをインターセプトし、カスタムロジックを追加できる機能。コマンド hook（stdin で JSON を受け取り、終了コード・stdout・stderr で結果を返す）と HTTP hook（同じ JSON を POST body で受け取り、HTTP レスポンスで返す）がある。

## 設定ファイル

`{claude設定ディレクトリ}/settings.json` または `.claude/settings.json` に記述。

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

- `matcher`: ツール名のパターン（大文字小文字を区別）。tool 系イベントでのみ意味を持つ
  - 完全一致: `"Write"`
  - 正規表現: `"Edit|Write"` または `"Notebook.*"`
  - 空文字列または省略: すべてにマッチ
- `type`: `"command"`（コマンド実行）または `"http"`（HTTP リクエスト）
- `command`: 実行するコマンド（`type: "command"` の場合）
- `timeout`（optional）: 最大実行時間（秒）

## Hook Events

tool 系・プロンプト系・セッション系・タスク系など多数のイベントがある。代表的なもの:

- `PreToolUse`: ツール実行前。実行を許可/拒否/確認できる
- `PostToolUse`: ツール実行後。結果のログ記録や追加コンテキスト注入に使用
- `UserPromptSubmit`: ユーザーのプロンプト送信時。検証や事前処理に使用
- `Stop` / `SubagentStop`: メイン/サブエージェント終了時
- `SessionStart` / `SessionEnd`: セッション開始/終了時
- `Notification`: Claude が通知を送信するとき
- `PreCompact` / `PostCompact`: コンテキスト圧縮の前後

> [!NOTE]
> 公式には上記以外にも `PermissionRequest` / `PermissionDenied` / `PostToolBatch` / `ConfigChange` / `Elicitation` / `WorktreeCreate` など多数のイベントが存在する。全リストと各イベント固有の入力スキーマは公式ドキュメントを参照。

## Hook 入力形式

コマンド hook は標準入力から、HTTP hook は POST body から JSON を受け取る。

### 共通入力フィールド

イベント固有フィールドに加え、以下が JSON で渡される。

- `session_id`: 現在のセッション識別子
- `transcript_path`: 会話 JSON のパス
- `cwd`: hook 起動時のカレントディレクトリ
- `permission_mode`: 現在の権限モード（`"default"` / `"plan"` / `"acceptEdits"` / `"auto"` / `"dontAsk"` / `"bypassPermissions"`）。イベントによっては渡されない
- `effort`: そのターンの effort レベルを持つオブジェクト（`level`: `"low"` / `"medium"` / `"high"` / `"xhigh"` / `"max"`）。`PreToolUse` / `PostToolUse` / `Stop` / `SubagentStop` 等の tool-use 文脈で発火するイベントに存在
- `hook_event_name`: 発火したイベント名

`--agent` 実行時やサブエージェント内では追加で渡される。

- `agent_id`: サブエージェントの識別子
- `agent_type`: エージェント名（例: `"Explore"`）

`model` フィールドは `SessionStart` のみ受け取れる（存在保証なし）。

### PreToolUse

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
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
  "transcript_path": "/Users/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
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

### UserPromptSubmit

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
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

コマンド hook は終了コード・stdout・stderr で、HTTP hook は HTTP ステータスとレスポンス body で結果を返す。

> [!IMPORTANT]
> 1 つの hook で「終了コードのみ」か「exit 0 + JSON 出力」のどちらか一方を選ぶ。両方は使えない。JSON は exit 0 のときだけ処理され、exit 2 のときは無視される。stdout には JSON オブジェクトのみを出力する。

### 終了コード

- `0`: 成功。stdout を [JSON 出力](#json-出力)としてパースする。大半のイベントで stdout はデバッグログに書かれるがトランスクリプトには出ない。例外は `UserPromptSubmit` / `UserPromptExpansion` / `SessionStart` で、stdout がコンテキストとして Claude に渡る
- `2`: ブロッキングエラー。stdout と JSON は無視され、stderr が Claude にエラーとして渡る。効果はイベント依存（`PreToolUse` ならツール呼び出しをブロック、`UserPromptSubmit` ならプロンプト却下、など）
- その他: 多くのイベントで非ブロッキングエラー。トランスクリプトに `<hook name> hook error` と stderr の 1 行目が表示され、処理は継続する

### HTTP レスポンス

- 2xx + 空 body: 成功（exit 0 相当）
- 2xx + plain text body: 成功。text がコンテキストとして追加される
- 2xx + JSON body: 成功。コマンド hook と同じ JSON 出力スキーマでパースされる
- 非 2xx / 接続失敗 / タイムアウト: 非ブロッキングエラー、処理継続

HTTP hook はステータスコードだけではブロッキングエラーを表現できない。ブロックするには 2xx + 適切な decision フィールドを含む JSON を返す。

### JSON 出力

JSON は 3 種類のフィールドを持つ。

- **普遍フィールド**（`continue` など）: 全イベントで有効
- **top-level `decision` / `reason`**: 一部イベントがブロックやフィードバックに使う
- **`hookSpecificOutput`**: より細かい制御が必要なイベント用のネストオブジェクト。`hookEventName` にイベント名を設定する必要がある

#### 普遍フィールド

- `continue`（デフォルト `true`）: `false` で hook 実行後に Claude の処理を完全に停止。イベント固有の decision より優先される
- `stopReason`: `continue` が `false` のときユーザーに表示するメッセージ（Claude には非表示）
- `suppressOutput`（デフォルト `false`）: `true` で hook の stdout をトランスクリプトから隠す（デバッグログには残る）
- `systemMessage`: ユーザーに表示する警告メッセージ
- `terminalSequence`（v2.1.141+）: Claude Code が代理で発行する端末エスケープシーケンス（デスクトップ通知・ウィンドウタイトル・ベル等。OSC `0`/`1`/`2`/`9`/`99`/`777` と BEL に限定）

```json
{ "continue": false, "stopReason": "Build failed, fix errors before continuing" }
```

文字列出力（`additionalContext` / `systemMessage` / plain stdout）は 10,000 文字で上限。超過分はファイルに保存され、プレビューとパスに置き換わる。

#### Decision control（イベント別の判定パターン）

| イベント                                                                                                                            | パターン             | 主なフィールド                                                                                                                                                          |
| :---------------------------------------------------------------------------------------------------------------------------------- | :------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UserPromptSubmit, UserPromptExpansion, PostToolUse, PostToolUseFailure, PostToolBatch, Stop, SubagentStop, ConfigChange, PreCompact | top-level `decision` | `decision: "block"`, `reason`。**値は `"block"` のみ**。Stop / SubagentStop は `hookSpecificOutput.additionalContext`（会話を継続させる非エラーフィードバック）も受ける |
| PreToolUse                                                                                                                          | `hookSpecificOutput` | `permissionDecision`（allow/deny/ask/defer）, `permissionDecisionReason`, `updatedInput`, `additionalContext`                                                           |
| PermissionRequest                                                                                                                   | `hookSpecificOutput` | `decision.behavior`（allow/deny）                                                                                                                                       |
| PermissionDenied                                                                                                                    | `hookSpecificOutput` | `retry: true`（モデルに再試行可と伝える）                                                                                                                               |
| SessionStart, Setup, SubagentStart                                                                                                  | コンテキストのみ     | `hookSpecificOutput.additionalContext`。ブロックや decision control はなし                                                                                              |
| Notification, SessionEnd, PostCompact, WorktreeRemove 等                                                                            | なし                 | decision control なし。ログ・クリーンアップ等の副作用用途                                                                                                               |

#### PreToolUse

PreToolUse は tool 系イベントで唯一 `hookSpecificOutput` で判定する。許可/拒否/ユーザー確認/委譲のほか、実行前のツール入力の書き換えやコンテキスト注入もできる。

```ts
{
  hookSpecificOutput?: {
    hookEventName: "PreToolUse",
    permissionDecision?: "allow" | "deny" | "ask" | "defer",
    permissionDecisionReason?: "判定の理由",
    updatedInput?: { /* 書き換えるツール引数のみ */ },
    additionalContext?: "ツール呼び出しに添えてモデルへ渡す文脈"
  }
}
```

- `permissionDecision`:
  - `"allow"`: 通常の権限フローをスキップして許可
  - `"deny"`: ツール呼び出しをブロック。`permissionDecisionReason` が Claude に表示される
  - `"ask"`: ユーザーの権限ダイアログにエスカレーション
  - `"defer"` / 省略: 権限判定をせず通常フローに委譲（許可ではない）。判定をしないだけで、`additionalContext` を併記すれば文脈注入は行われる
- `permissionDecisionReason`: `"deny"` / `"ask"` のときユーザーに表示。`"allow"` / `"defer"` では表示されない
- `updatedInput`: 実行前にツール引数を置き換える（Bash なら `command` を差し替え）
- `additionalContext`: `permissionDecision` を省いて単体で返すと、ブロック・承認のいずれもせずモデルの文脈に注入される（警告用途）

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Publishing is not allowed in this session"
  }
}
```

#### top-level decision 系（PostToolUse / Stop / SubagentStop / UserPromptSubmit 等）

これらは top-level の `decision` で制御する。**指定できる値は `"block"` のみ**。許可（処理続行）は `decision` を省くか、JSON を出さず exit 0 する。

```json
{
  "decision": "block",
  "reason": "Test suite must pass before proceeding"
}
```

- `PostToolUse`: `reason` を Claude にフィードバック（ツールは既に実行済み）
- `Stop` / `SubagentStop`: 停止を阻止して会話を継続。`reason` で続行方法を説明
- `UserPromptSubmit`: プロンプト処理をブロック

#### additionalContext の挙動

`hookSpecificOutput.additionalContext` はモデルのコンテキストウィンドウに文字列を注入する。Claude Code は system reminder で包み、hook が発火した位置に挿入する。Claude は次のモデルリクエストで読むが、チャットメッセージとしては表示されない。挿入位置はイベント依存。

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "This file is generated. Edit src/schema.ts and run `bun generate` instead."
  }
}
```

命令文ではなく事実の記述として書く（「The deployment target is production」のように）。命令調のテキストは prompt-injection 防御を誘発し、コンテキストとして扱われずユーザーに提示されることがある。
