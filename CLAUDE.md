# Claude Hooks Script

Claude Code 用の hook スクリプトを実装するプロジェクト

## 概要

このプロジェクトは`bunx github:miyaoka/claude-hooks-script`で実行可能な Claude Code 用の hook スクリプトを提供する
Claude Code のツール使用をインターセプトし、カスタムロジックを追加できる

## 技術スタック

- Bun (ランタイム・テストランナー)
- TypeScript

## プロジェクト構成

```
src/
├── index.ts          # エントリーポイント（標準入力からJSONを受け取る）
├── main.ts           # メインロジック（JSON解析、検証、hook処理）
├── core/             # Hook処理の中核となる検証とルーティング機能
├── cli/              # コマンドライン引数解析、入力取得、設定ファイル処理
├── config/           # 設定ファイルの読み込み、検証、パス解決
├── handlers/         # 各種Hookの処理実装。preToolUse配下にツール別ハンドラー
├── parsers/          # コマンド文字列の解析処理
├── types/            # TypeScript型定義。hook/配下にhook関連、userConfig.tsに設定型
├── utils/            # 共通ユーティリティ（デバッグ、Result型、マッチング処理）
└── messages/         # ユーザー向けメッセージテンプレート
```

## 検証コマンド

```sh
## lint
bun run lint --fix

## test
bun run test

## typecheck
bun run typecheck
```

TDD アプローチに従い、まずテストを書いてから実装する

## 実装済み機能

### PreToolUse Hook

- Bashツールの実行を検証・制御
- コマンドとargsによるルールマッチング
- 正規表現によるargsパターンマッチング
- decision（block/approve）による実行制御
- WebFetchツールのドメインベース制御
- WebSearchツールのクエリベース制御

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

## Hook Types

- PreToolUse: ツール実行前の検証（実装済み）
  - Bash: コマンドとargsでのマッチング
  - WebFetch: URLのドメインでのマッチング
  - WebSearch: 検索クエリでのマッチング

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
