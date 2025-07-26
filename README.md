# @miyaoka/claude-hooks

Claude Code 用の hook スクリプト。ツール実行前に検証・制御を行うことができる。

## 機能

- Bashコマンドの実行制御（コマンド名、引数パターンでのマッチング）
- WebFetchのURLドメイン制御
- WebSearchのクエリ制御
- 設定ファイルによる柔軟なルール定義

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/miyaoka/claude-hook-script.git
cd claude-hook-script

# ツールをインストール
mise install

# ローカルでリンク （bunxで実行できるようにするため）
bun link
```

## 設定方法

### 1. hook設定ファイルを作成

まず、hookの動作を制御する設定ファイルを作成する。以下のいずれかの場所に`hooks.config.json`を配置：

- `~/.claude/hooks.config.json`（ユーザー共通設定）
- `{プロジェクトルート}/.claude/hooks.config.json`（プロジェクト固有設定）

```json
[
  {
    "event": "preToolUse",
    "tool": "Bash",
    "command": "rm",
    "args": "-rf",
    "decision": "block",
    "reason": "危険なrmコマンドの実行をブロック"
  }
]
```

完全な設定例は[examples/hooks.config.json](examples/hooks.config.json)を参照。
詳細な設定方法は[docs/config-spec.md](docs/config-spec.md)を参照。

設定ファイルが正しく読み込まれるか確認するには：

```bash
bunx @miyaoka/claude-hooks --test
```

### 2. Claude Codeのhooksに設定

Claude Code の設定ファイル（`~/.claude/settings.json`または`.claude/settings.json`）に以下のように記述：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "tool": "",
        "hooks": [
          {
            "type": "command",
            "command": "bunx @miyaoka/claude-hooks"
          }
        ]
      }
    ]
  }
}
```

## 動作確認

### テストモード

```bash
# サンプル入力でテスト
bunx @miyaoka/claude-hooks --test

# デバッグモードで実行
bunx @miyaoka/claude-hooks --debug --test
```

### デバッグ

デバッグモードでは以下のファイルに情報が記録される：

```bash
# Hook入力のJSONLダンプ
tail -f /tmp/claude-hook-dump.jsonl

# デバッグログ
tail -f /tmp/claude-hook-debug.log
```

## 開発

```bash
# 依存関係をインストール
bun install

# lint
bun run lint --fix

# test
bun run test

# typecheck
bun run typecheck
```

### プロジェクト構成

- `src/index.ts`: エントリーポイント
- `src/main.ts`: メインロジック
- `src/handlers/`: 各hookタイプのハンドラー
- `src/config/`: 設定ファイルの読み込み・検証
- `docs/`: ドキュメント
