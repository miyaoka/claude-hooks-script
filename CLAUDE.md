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

### デバッグ機能

- `/tmp/claude-hook-dump.jsonl`: Hook入力のJSONLダンプ
- `/tmp/claude-hook-debug.log`: デバッグログ

## Hook Types

- PreToolUse: ツール実行前の検証（実装済み）
- PostToolUse: ツール実行後の処理（未実装）
- Notification: 通知の処理（未実装）
- Stop: セッション終了時の処理（未実装）
- SubagentStop: サブエージェント終了時の処理（未実装）
- PreCompact: コンテキスト圧縮前の処理（未実装）
- UserPromptSubmit: プロンプト送信時の処理（未実装）
