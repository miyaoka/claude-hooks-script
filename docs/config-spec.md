# 設定ファイル仕様

## PreToolUse設定

各ルールには以下のフィールドを指定する：

- `event`: "preToolUse" - イベントタイプ（必須）
- `tool`: ツール名（必須）。"Bash", "WebFetch", "WebSearch"、その他のツール名も指定可能
- `reason`: 判定理由（必須）
- `decision`: "block" または "approve" - 判定結果（オプション、未指定の場合はreasonのみ表示）

ツール固有のフィールド：

- Bashツール:
  - `command`: コマンド名（オプション）
  - `args`: 引数パターン（正規表現）（オプション）
- WebFetchツール:
  - `domain`: URLドメインパターン（正規表現）（オプション）
- WebSearchツール:
  - `query`: クエリパターン（正規表現）（オプション）

### 設定例

```json
[
  {
    "event": "preToolUse",
    "tool": "Bash",
    "command": "rm",
    "args": "-rf\\s+~",
    "decision": "block",
    "reason": "⚠️ ホームディレクトリの削除は禁止"
  },
  {
    "event": "preToolUse",
    "tool": "WebFetch",
    "domain": "(internal|private)\\.company\\.com",
    "decision": "block",
    "reason": "⚠️ 内部サイトへのアクセスは禁止"
  },
  {
    "event": "preToolUse",
    "tool": "WebSearch",
    "query": "password|api.?key|secret",
    "decision": "block",
    "reason": "⚠️ 機密情報の検索は禁止"
  }
]
```

### Bashコマンドの処理

Bashツールの場合、コマンドは以下のように解析される：

1. `&&`、`;`、`|`などで分割して個々のコマンドを抽出
2. 各コマンドをコマンド名と引数に分解
3. ルールと照合し、マッチしたら対応するdecisionを返す

例：`cd foo && ls -al && rm -rf ~/` は `cd`、`ls`、`rm` の3つのコマンドとして評価される

### マッチングルールと優先順位

#### 基本ルール

1. **デフォルト設定**: `args`なしの設定はそのコマンドのデフォルト動作を定義
2. **特定条件の設定**: `args`ありの設定は特定の引数パターンに対する動作を定義

#### 優先順位

1. より具体的な設定（`args`あり）が一般的な設定（`args`なし）より優先される
2. 同じ具体度の設定は、配列の後の要素が前の要素を上書きする
3. **複数のルールがマッチする場合**: `decision`の強さで決定
   - 強さの順序: `block` > `undefined` > `approve`
   - 安全側に倒す原則（より制限的な設定を優先）

#### 上書きルール

- **`args`なしの同じ`command`**: 配列の後者で上書き
- **`args`ありの設定**: `command`と`args`の両方が同一の場合のみ、配列の後者で上書き

#### 設定例

```json
[
  {
    "event": "preToolUse",
    "tool": "Bash",
    "command": "cat",
    "decision": "approve",
    "reason": "catコマンドは基本的に許可"
  },
  {
    "event": "preToolUse",
    "tool": "Bash",
    "command": "cat",
    "args": "password|secret|\\.env",
    "decision": "block",
    "reason": "⚠️ 機密情報を含む可能性のあるファイルの閲覧は禁止"
  },
  {
    "event": "preToolUse",
    "tool": "Bash",
    "command": "rm",
    "decision": "block",
    "reason": "rmコマンドはデフォルトで禁止"
  },
  {
    "event": "preToolUse",
    "tool": "Bash",
    "command": "rm",
    "args": "\\.tmp$|\\.cache",
    "decision": "approve",
    "reason": "一時ファイルの削除は許可"
  }
]
```

この例では：

- `cat` は基本的に許可されるが、パスワードや秘密情報を含むファイルはブロック
- `rm` は基本的に禁止されるが、一時ファイルの削除は許可

#### 複数マッチの例

```json
[
  {
    "event": "preToolUse",
    "tool": "Bash",
    "command": "rm",
    "args": "\\.log$",
    "decision": "approve",
    "reason": "ログファイルの削除は許可"
  },
  {
    "event": "preToolUse",
    "tool": "Bash",
    "command": "rm",
    "args": "production",
    "decision": "block",
    "reason": "⚠️ productionを含むパスの削除は禁止"
  }
]
```

`rm production.log` の場合：

- 両方のルールにマッチ
- `approve` と `block` が競合
- `block` > `approve` なので、**ブロックされる**（安全側に倒す）

### WebFetchの設定

WebFetchツールの場合、URLのドメイン部分でマッチングを行う：

```json
[
  {
    "event": "preToolUse",
    "tool": "WebFetch",
    "decision": "approve",
    "reason": "デフォルトで全てのURLを許可"
  },
  {
    "event": "preToolUse",
    "tool": "WebFetch",
    "domain": "(github|gitlab)\\.com",
    "decision": "approve",
    "reason": "GitHub/GitLabは許可"
  },
  {
    "event": "preToolUse",
    "tool": "WebFetch",
    "domain": "localhost|127\\.0\\.0\\.1",
    "decision": "block",
    "reason": "⚠️ ローカルホストへのアクセスは禁止"
  }
]
```

### WebSearchの設定

WebSearchツールの場合、検索クエリでマッチングを行う：

```json
[
  {
    "event": "preToolUse",
    "tool": "WebSearch",
    "decision": "approve",
    "reason": "デフォルトで全ての検索を許可"
  },
  {
    "event": "preToolUse",
    "tool": "WebSearch",
    "query": "\\b(typescript|javascript|python)\\b",
    "decision": "approve",
    "reason": "プログラミング言語の検索は許可"
  },
  {
    "event": "preToolUse",
    "tool": "WebSearch",
    "query": "(crack|hack|exploit)",
    "decision": "block",
    "reason": "⚠️ 不正なアクセスに関する検索は禁止"
  }
]
```

## 設定ファイルの読み込み

設定ファイルは以下のパスから読み込まれる：

**ユーザー設定**（いずれか1つ、上から優先）:

1. `$CLAUDE_CONFIG_DIR/hooks.config.json`
2. `$HOME/.config/claude/hooks.config.json`
3. `$HOME/.claude/hooks.config.json`

**プロジェクト設定**:

- `{プロジェクトルート}/.claude/hooks.config.json`

ユーザー設定とプロジェクト設定の両方が存在する場合は、それらがマージされる。起動時に設定ファイルの検証が行われ、無効な設定がある場合はエラーメッセージを表示して終了する
