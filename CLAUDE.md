# Claude Hooks Script

Claude Code 用の hook スクリプトを実装するプロジェクト

## 概要

このプロジェクトは`bunx claude-hooks`で実行可能な Claude Code 用の hook スクリプトを提供する。
Claude Code のツール使用をインターセプトし、カスタムロジックを追加できる。

## 技術スタック

- Bun (ランタイム・テストランナー)
- TypeScript

## アーキテクチャ

- `src/hook-handler.ts`: メインのルーティングロジック
- `src/types.ts`: 型定義
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

TDD アプローチに従い、まずテストを書いてから実装する。

## Hook Types

- PreToolUse: ツール実行前の検証
- PostToolUse: ツール実行後の処理
- Notification: 通知の処理
- Stop: セッション終了時の処理
- SubagentStop: サブエージェント終了時の処理
- PreCompact: コンテキスト圧縮前の処理
