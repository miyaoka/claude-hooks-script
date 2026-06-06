# 設定ファイル仕様

このスクリプトは Claude Code の **PreToolUse / Bash** 実行時のチェックに特化している。設定はBashルールの配列。

## ルールのフィールド

- `reason`: 判定理由（必須）
- `command`: コマンド名（オプション）
- `args`: 引数パターン（正規表現または部分文字列）（オプション）
- `decision`: `"block"` または `"approve"`（オプション。未指定の場合は reason のみ表示）

### 設定例

```json
[
  {
    "command": "rm",
    "args": "-rf\\s+~",
    "decision": "block",
    "reason": "ホームディレクトリの削除は禁止"
  },
  {
    "command": "ls",
    "decision": "approve",
    "reason": "lsは常に許可"
  }
]
```

## Bashコマンドの処理

入力された Bash コマンドは以下のように解析される：

- `&&` / `||` / `;` / `|` / `&` でトップレベルを分割
- `$(...)` とバッククォートで囲まれた command substitution の中身も独立コマンドとして抽出（ネストは非対応）
- クォート内の区切り文字はリテラル扱い
- redirect 構文（`>&2` / `2>&1` / `&>` / `&>>` など）の `&` は分離しない
- 各コマンドをコマンド名と引数に分解
- ルールと照合し、マッチしたら対応する decision を返す

例：

- `cd foo && ls -al && rm -rf ~/` は `cd` / `ls` / `rm` の 3 つのコマンドとして評価される
- `echo $(rm -rf ~)` は `echo`（args 空）と `rm`（args=`-rf ~`）の 2 つとして評価される
- `sleep 0 & rm -rf /var` は `sleep` と `rm` の 2 つに分離される
- `make 2>&1 | tee log` は `make`（args=`2>&1`）と `tee` に分離される（`&` は redirect の一部なので保持）

## マッチングルールと優先順位

### 基本ルール

- **デフォルト設定**: `args` なしの設定はそのコマンドのデフォルト動作を定義
- **特定条件の設定**: `args` ありの設定は特定の引数パターンに対する動作を定義

### 優先順位

- より具体的な設定（`args` あり）が一般的な設定（`args` なし）より優先される
- 同じ具体度の設定は、配列の後の要素が前の要素を上書きする
- **複数のルールがマッチする場合**: `decision` の強さで決定
  - 強さの順序: `block` > `undefined` > `approve`
  - 安全側に倒す原則（より制限的な設定を優先）

### 上書きルール

- **`args` なしの同じ `command`**: 配列の後者で上書き
- **`args` ありの設定**: `command` と `args` の両方が同一の場合のみ、配列の後者で上書き

### 設定例

```json
[
  {
    "command": "cat",
    "decision": "approve",
    "reason": "catコマンドは基本的に許可"
  },
  {
    "command": "cat",
    "args": "password|secret|\\.env",
    "decision": "block",
    "reason": "機密情報を含む可能性のあるファイルの閲覧は禁止"
  },
  {
    "command": "rm",
    "decision": "block",
    "reason": "rmコマンドはデフォルトで禁止"
  },
  {
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

### 複数マッチの例

```json
[
  {
    "command": "rm",
    "args": "\\.log$",
    "decision": "approve",
    "reason": "ログファイルの削除は許可"
  },
  {
    "command": "rm",
    "args": "production",
    "decision": "block",
    "reason": "productionを含むパスの削除は禁止"
  }
]
```

`rm production.log` の場合：

- 両方のルールにマッチ
- `approve` と `block` が競合
- `block` > `approve` なので、**ブロックされる**（安全側に倒す）

## 設定ファイルの読み込み

設定ファイルは以下のパスから読み込まれる：

**ユーザー設定**（いずれか1つ、上から優先）:

- `$CLAUDE_CONFIG_DIR/hooks.config.json`
- `$HOME/.config/claude/hooks.config.json`
- `$HOME/.claude/hooks.config.json`

**プロジェクト設定**:

- `{プロジェクトルート}/.claude/hooks.config.json`

ユーザー設定とプロジェクト設定の両方が存在する場合は、それらがマージされる。起動時に設定ファイルの検証が行われ、無効な設定がある場合はエラーメッセージを表示して終了する。

## Bash 以外のツール

PreToolUse 以外の hook イベントや、PreToolUse でも Bash 以外のツール（Write, Edit, WebFetch, WebSearch など）はすべて素通し（空レスポンス `{}`）となり、Claude Code 本体のデフォルト権限フローに委ねられる。WebFetch / WebSearch の許可ドメインや検索クエリ制御は本スクリプトでは扱わないので、Claude Code 本体の `permissions` / `settings.json` 側で設定する。

## 設定の妥当性検証

設定ファイルは厳格に検証される。次のいずれかが満たされない場合は validation error で起動失敗する：

- `command` / `reason` が string で必ず存在する
- `args` が定義されていれば string
- `decision` が定義されていれば `"block"` または `"approve"`
- ルール内のフィールドは `command` / `args` / `decision` / `reason` のみ。`event` / `tool` / `domain` / `query` 等の未知フィールドが含まれていれば error（旧スキーマがサイレントに無効化される事故を防ぐため）
