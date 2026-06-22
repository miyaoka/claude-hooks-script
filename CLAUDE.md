# Claude Hooks Script

Claude Code 用の hook スクリプトを実装するプロジェクト

## 概要

このプロジェクトは`bunx github:miyaoka/claude-hooks-script`で実行可能な Claude Code 用の hook スクリプトを提供する
Claude Code の PreToolUse / Bash 実行をインターセプトし、ルールに基づいて公式 hook レスポンスを返す

## 設計原則（最重要）

**config は、公式 PreToolUse レスポンス（`hookSpecificOutput`）にマッチパターンを足しただけのもの。**

- 1 ルール = マッチパターン（`command` / `args`、このリポジトリが公式に足す唯一の要素）＋ 公式 `hookSpecificOutput` のフィールドをそのまま宣言したもの
- 公式 `hookSpecificOutput` のフィールド（`hookEventName` は固定で不要）:
  - `permissionDecision`: `allow` / `deny` / `ask` / `defer`
  - `permissionDecisionReason`: `deny` / `ask` の理由（公式上この 2 値で必須、`allow` / `defer` では非表示）
  - `additionalContext`: モデルへ注入する文脈。`permissionDecision` と独立（併用可・単体可）
  - `updatedInput`: 実行前のツール引数の書き換え
- フックの仕事 = マッチしたら、そのルールの公式フィールドを `hookSpecificOutput` に**素通し**で載せて返すだけ
- フィールド間に独自のカップリングを作らない（例: 1 つの `reason` を `permissionDecision` の有無で `permissionDecisionReason` と `additionalContext` に振り分ける、は公式に無い構造であり禁止）

唯一リポジトリ独自のロジックは、**複数ルールがマッチしたとき**（複合コマンド・重複マッチ）に単一レスポンスへ合成する処理:

- `permissionDecision`: 最も制限的を採用（`deny` > `ask` > `allow` > `defer`）＋その `permissionDecisionReason` / `updatedInput`
- `additionalContext`: マッチした全ルールの値を集約（公式も複数値を全て配信する）

型は `src/types.ts` で公式部分（`PreToolUseHookOutput` ＝ permissionDecision で判別する union）とこのリポジトリ独自部分（`MatchPattern`）を分離し、`BashRule = MatchPattern & PreToolUseDecision` で表す。

## 技術スタック

- Bun (ランタイム・テストランナー)
- pnpm (パッケージマネージャ)
- TypeScript / tsgo (`@typescript/native-preview`)
- oxlint + oxfmt (lint / format)
- lefthook (git hooks)
- mise (Bun / pnpm のバージョン固定)

## プロジェクト構成

```
src/
├── index.ts        # エントリーポイント
├── main.ts         # JSON解析・検証・dispatch
├── bash.ts         # Bashルール評価
├── bashParser.ts   # Bashコマンドの分割
├── config.ts       # 設定ファイル読み込み・検証
├── cli.ts          # 引数解析・入力取得・debug
├── matcher.ts      # 正規表現/部分一致マッチング
├── result.ts       # Result型ユーティリティ
└── types.ts        # 型定義
```

## 検証コマンド

```sh
## lint (check)
pnpm run lint

## lint + format (auto-fix)
pnpm run fix

## test
pnpm run test

## typecheck
pnpm run typecheck
```

TDD アプローチに従い、まずテストを書いてから実装する

## 実装済み機能

### PreToolUse / Bash チェック

- Bashコマンドとargsによるルールマッチング
- 正規表現または部分一致によるargsパターンマッチング
- マッチしたルールの公式フィールド（permissionDecision / permissionDecisionReason / additionalContext / updatedInput）を素通しで返す
- 複合コマンド（`&&` / `;` / `|`）の各サブコマンドを個別評価し、複数マッチは合成（上記「設計原則」参照）
- PreToolUse 以外、または Bash 以外のツールは素通し

### デバッグ機能

- `-d, --debug [file]`オプションでデバッグモード有効化
- デフォルトログファイル: `/tmp/claude-hooks-debug.log`
- カスタムログファイル指定可能: `-d custom.log`

### 設定ファイル

設定ファイルは以下のパスから読み込まれる：

**ユーザー設定**（いずれか1つ、上から優先）:

1. `$CLAUDE_CONFIG_DIR/hooks.config.json`
2. `$HOME/.config/claude/hooks.config.json`
3. `$HOME/.claude/hooks.config.json`

**プロジェクト設定**:

- `{プロジェクトルート}/.claude/hooks.config.json`

ユーザー設定とプロジェクト設定の両方が存在する場合は、それらがマージされる。起動時に設定ファイルの検証が行われ、無効な設定がある場合はエラーメッセージを表示して終了する

## 対応 Hook

- PreToolUse + tool_name: "Bash" のみ処理
  - その他の hook event / tool は空レスポンス（`{}`）で素通し

## 使用方法

```sh
# Claude Code hookとして（標準入力経由）
echo '{...}' | bunx github:miyaoka/claude-hooks-script

# ファイルから入力
bunx github:miyaoka/claude-hooks-script test-input.json

# テストモード（サンプル入力で動作確認）
bunx github:miyaoka/claude-hooks-script --test

# デバッグモード有効
bunx github:miyaoka/claude-hooks-script --debug
```
