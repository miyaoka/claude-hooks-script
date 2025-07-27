# @miyaoka/claude-hooks

Claude Code がツールを実行する際に呼び出される hook スクリプト。Claude Code からの hook 入力を受け取り、設定ファイルのルールに従ってツール実行を制御（許可/ブロック）する。

## 機能

- Bashコマンドの実行制御（コマンド名、引数パターンでのマッチング）
- WebFetchのURLドメイン制御
- WebSearchのクエリ制御
- 設定ファイルによる柔軟なルール定義

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/miyaoka/claude-hooks-script.git
cd claude-hooks-script

# ツールをインストール
mise install

# ローカルでリンク （bunxで実行できるようにするため）
bun link
```

## 設定方法

### 1. hook設定ファイルを作成

まず、hookの動作を制御する設定ファイルを作成する。以下のいずれかの場所に`hooks.config.json`を配置：

- `{claudeの設定ディレクトリ}/hooks.config.json`（ユーザー共通設定）
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

- 設定例は[examples/hooks.config.json](examples/hooks.config.json)を参照。
- 詳細な設定方法は[docs/config-spec.md](docs/config-spec.md)を参照。

### 2. Claude Codeのhooksに設定

Claude Code の設定ファイル（`{claude設定ディレクトリ}/settings.json`または`.claude/settings.json`）に以下のように記述：

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

この設定により、Claude Code がツールを実行しようとする際に自動的にこのスクリプトが呼び出される。スクリプトは標準入力経由でツール実行情報を受け取り、設定ファイルのルールに基づいて実行を許可またはブロックする。

### 3. 動作確認（推奨）

配置したconfigがinputに対して正しく機能しているかターミナルで実行確認できる

```bash
# デフォルトのinput内容でユーザーconfigをテスト
bunx @miyaoka/claude-hooks

# input内容を指定したい場合
bunx @miyaoka/claude-hooks -i hooks.input.json
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
