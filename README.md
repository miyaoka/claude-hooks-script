# @miyaoka/claude-hooks

Claude Code がツールを実行する際に呼び出される hook スクリプト。設定ファイルのルールに従ってツール実行を制御（許可/ブロック）する。

## 前提条件

- [Bun](https://bun.sh/)

## 使い方

### Claude Codeのhooksに設定

Claude Code の設定ファイル（`~/.claude/settings.json`または`.claude/settings.json`）に以下を記述：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bunx github:miyaoka/claude-hooks-script"
          }
        ]
      }
    ]
  }
}
```

### hook設定ファイルを作成

hookの動作を制御する設定ファイルを作成する。以下のいずれかの場所に`hooks.config.json`を配置：

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

- 設定例: [examples/hooks.config.json](examples/hooks.config.json)
- 詳細な設定方法: [docs/config-spec.md](docs/config-spec.md)

### 動作確認

```bash
# デフォルトのinput内容でユーザーconfigをテスト
bunx github:miyaoka/claude-hooks-script

# input内容を指定したい場合
bunx github:miyaoka/claude-hooks-script -i hooks.input.json
```

## 開発

```bash
# 依存関係をインストール
bun install

# 開発時の実行
bun run dev

# 開発時の実行（サンプル設定付き）
bun run dev:example

# カスタム入力/設定での実行
bun run dev --input my-input.json --config my-config.json

# lint
bun run lint --fix

# test
bun run test

# typecheck
bun run typecheck
```

### プロジェクト構成

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
