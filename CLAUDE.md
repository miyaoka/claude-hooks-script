# Claude Hooks Script

Claude Code 用の hook スクリプトを実装するプロジェクト

## 概要

このプロジェクトは`bunx github:miyaoka/claude-hooks-script`で実行可能な Claude Code 用の hook スクリプトを提供する
Claude Code の PreToolUse / Bash 実行をインターセプトし、ルールに基づいて許可/ブロックを判定する

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
- decision（deny/allow）による実行制御
- 複合コマンド（`&&` / `;` / `|`）の各サブコマンドを個別評価
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
