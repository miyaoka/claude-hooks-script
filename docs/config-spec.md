# 設定ファイル仕様

このスクリプトは Claude Code の **PreToolUse / Bash** 実行時のチェックに特化している。設定は Bash ルールの配列。

**1 ルール = マッチパターン（このリポジトリ独自）＋ 公式 `hookSpecificOutput` のフィールド（素通し）。** マッチしたら、そのルールに書かれた公式フィールドをそのまま返す。

## ルールのフィールド

### マッチパターン（このリポジトリが公式に足す部分）

- `command`: コマンド名（必須）。`"*"` を指定するとワイルドカードルールになる（後述）
- `args`: 引数パターン（正規表現または部分文字列）（オプション。ワイルドカードルールでは必須）

### 公式レスポンスフィールド（[PreToolUse decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control) の素通し）

- `permissionDecision`: `"allow"` / `"deny"` / `"ask"` / `"defer"`
  - `allow`: 通常の権限フローをスキップして許可
  - `deny`: ブロック。`permissionDecisionReason` が Claude に表示される
  - `ask`: ユーザーの権限ダイアログにエスカレーション
  - `defer`: 権限判定をせず通常フローに委譲
- `permissionDecisionReason`: `deny` / `ask` の理由。**この 2 値では必須**。`allow` / `defer` では公式上表示されないため**指定不可**
- `additionalContext`: モデルへ注入する文脈。`permissionDecision` と独立し、どの decision とも併用でき、単体でも指定できる
- `updatedInput`: 実行前に Bash の command を差し替える（`{ "command": "..." }`）。`permissionDecision: "allow"` のときのみ指定可

ルールは `permissionDecision` か `additionalContext` の少なくとも一方を持つ必要がある。

### 設定例

```json
[
  {
    "command": "rm",
    "args": "-rf\\s+~",
    "permissionDecision": "deny",
    "permissionDecisionReason": "ホームディレクトリの削除は禁止"
  },
  {
    "command": "ls",
    "permissionDecision": "allow"
  },
  {
    "command": "psql",
    "permissionDecision": "allow",
    "additionalContext": "本番DBに接続している"
  },
  {
    "command": "git",
    "args": "commit",
    "additionalContext": "コミット前に lint と test を通すこと"
  }
]
```

> [!NOTE]
> `additionalContext` の文字列は命令文ではなく事実の記述で書く。命令調は prompt-injection 防御で握り潰されうる（`claude-hooks-spec.md` の additionalContext 節を参照）。`permissionDecisionReason` はこの制約を受けない。

## Bashコマンドの処理

入力された Bash コマンドは以下のように解析される：

- `&&` / `||` / `;` / `|` / `&` でトップレベルを分割
- `$(...)` とバッククォートで囲まれた command substitution の中身も独立コマンドとして抽出（ネストは非対応）
- クォート内の区切り文字はリテラル扱い
- redirect 構文（`>&2` / `2>&1` / `&>` / `&>>` など）の `&` は分離しない
- 各コマンドをコマンド名と引数に分解
- ルールと照合し、マッチしたルールの公式フィールドを返す

例：

- `cd foo && ls -al && rm -rf ~/` は `cd` / `ls` / `rm` の 3 つのコマンドとして評価される
- `echo $(rm -rf ~)` は `echo`（args 空）と `rm`（args=`-rf ~`）の 2 つとして評価される
- `sleep 0 & rm -rf /var` は `sleep` と `rm` の 2 つに分離される
- `make 2>&1 | tee log` は `make`（args=`2>&1`）と `tee` に分離される（`&` は redirect の一部なので保持）

## ワイルドカードルール

`command: "*"` のルールは、コマンド分割後の引数ではなく**分割前の生のコマンド文字列全体**に `args` パターンを照合する。

コマンド単位の照合は変数代入で迂回できる（`f=/path/to/node_modules/pkg/index.js; cat "$f"` では `cat` の引数に `node_modules` が現れない）ため、特定の文字列を含むコマンドを丸ごと禁止したい場合はワイルドカードルールを使う。

```json
[
  {
    "command": "*",
    "args": "node_modules",
    "permissionDecision": "deny",
    "permissionDecisionReason": "node_modulesを直接読むな。ghqでソースリポジトリを取得して調べろ"
  }
]
```

- `args` は必須。args なしの `"*"` は全コマンド無条件マッチになるため validation error
- マッチ結果は通常ルールと同じ土俵で合成に参加する（ワイルドカードの deny はコマンド別の allow に勝つ）

## マッチングと合成

### マッチ

- **デフォルト設定**: `args` なしの設定はそのコマンドのデフォルト動作を定義
- **特定条件の設定**: `args` ありの設定は特定の引数パターンに対する動作を定義
- より具体的な設定（`args` あり）が一般的な設定（`args` なし）より優先される
- 同じ具体度の設定は、配列の後の要素が前の要素を上書きする（`command` と `args` の両方が同一の場合のみ）

### 合成（複数ルールがマッチしたとき）

単一の公式レスポンスへまとめる。

- `permissionDecision`: 最も制限的なルールを採用し、その `permissionDecisionReason` / `updatedInput` を引き継ぐ
  - 強さの順序: `deny` > `ask` > `allow` > `defer`（安全側に倒す）
- `additionalContext`: マッチした全ルールの値を改行で連結して集約（公式も複数値を全配信する）

### 例

```json
[
  {
    "command": "rm",
    "args": "\\.log$",
    "permissionDecision": "allow"
  },
  {
    "command": "rm",
    "args": "production",
    "permissionDecision": "deny",
    "permissionDecisionReason": "productionを含むパスの削除は禁止"
  }
]
```

`rm production.log` の場合、両方にマッチし `allow` と `deny` が競合する。`deny` > `allow` なので**ブロックされる**。

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

- `command` が string で必ず存在する
- `args` が定義されていれば string。`command: "*"` は `args` 必須
- `permissionDecision` が定義されていれば `"allow"` / `"deny"` / `"ask"` / `"defer"`
- `permissionDecisionReason` は `deny` / `ask` で必須、それ以外では指定不可。空文字列は不可
- `additionalContext` が定義されていれば非空 string
- `updatedInput` は `permissionDecision: "allow"` のときのみ、`{ command: 非空 string }` の形
- ルールは `permissionDecision` か `additionalContext` の少なくとも一方を持つ
- ルール内のフィールドは上記のみ。`decision` / `reason` / `event` / `tool` / `domain` / `query` 等の未知フィールドが含まれていれば error（旧スキーマがサイレントに無効化される事故を防ぐため）
