# Claude Hooks Script

Claude Code用のhookスクリプトを実装するプロジェクト

## 概要

このプロジェクトは`bunx claude-hooks`で実行可能なClaude Code用のhookスクリプトを提供する。
Claude Codeのツール使用をインターセプトし、カスタムロジックを追加できる。

## 技術スタック

- Bun (ランタイム・テストランナー)
- TypeScript
- TDD (Test-Driven Development)

## アーキテクチャ

- `src/hook-handler.ts`: メインのルーティングロジック
- `src/types.ts`: 型定義
- `docs/claude-hooks-spec.md`: Claude hooks仕様のドキュメント

## テスト

```sh
bun test
```

TDDアプローチに従い、まずテストを書いてから実装する。

## Hook Types

- PreToolUse: ツール実行前の検証
- PostToolUse: ツール実行後の処理
- Notification: 通知の処理
- Stop: セッション終了時の処理
- SubagentStop: サブエージェント終了時の処理
- PreCompact: コンテキスト圧縮前の処理

## 開発状況

- [x] 基本構造の実装
- [x] 型定義
- [x] hookタイプの判別とルーティング
- [ ] 各ハンドラーの実装
- [ ] 設定ファイルの読み込み
- [ ] メインエントリーポイント（stdin処理）