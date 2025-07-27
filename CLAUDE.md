# Claude Hooks Script

Claude Code 用の hook スクリプトを実装するプロジェクト

## 概要

このプロジェクトは`bunx @miyaoka/claude-hooks`で実行可能な Claude Code 用の hook スクリプトを提供する
Claude Code のツール使用をインターセプトし、カスタムロジックを追加できる

## 技術スタック

- Bun (ランタイム・テストランナー)
- TypeScript

## アーキテクチャ

### コア

- `src/index.ts`: エントリーポイント（標準入力からJSONを受け取る）
- `src/main.ts`: メインロジック（JSON解析、検証、hook処理）
- `src/core/hookInputHandler.ts`: Hook入力のルーティング
- `src/core/hookInputValidator.ts`: Hook入力の検証

### ハンドラー

- `src/handlers/preToolUse.ts`: PreToolUseフックのメインハンドラー
- `src/handlers/preToolUse/bash.ts`: Bashツール専用のハンドラー

### パーサー

- `src/parsers/bashParser.ts`: Bashコマンドの解析

### 型定義

- `src/types/hook/`: Hook関連の型定義
  - `input/`: 各種Hook入力型（PreToolUse, PostToolUse等）
  - `response/`: Hook応答型
- `src/types/userConfig.ts`: ユーザー設定の型定義

### ユーティリティ

- `src/utils/debug.ts`: デバッグ出力（/tmpへのダンプ）
- `src/utils/result.ts`: Result型（エラーハンドリング）

### ドキュメント

- `docs/claude-hooks-spec.md`: Claude hooks 仕様のドキュメント

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
echo '{...}' | bunx @miyaoka/claude-hooks

# ファイルから入力
bunx @miyaoka/claude-hooks test-input.json

# テストモード（サンプル入力で動作確認）
bunx @miyaoka/claude-hooks --test

# デバッグモード有効
bunx @miyaoka/claude-hooks --debug
```
