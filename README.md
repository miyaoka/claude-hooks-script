# @miyaoka/claude-hooks

Claude Code の PreToolUse / Bash 実行時に呼び出される hook スクリプト。設定ファイルのルールに従って Bash コマンド実行を制御（許可/ブロック）する。

## 前提条件

実行用:

- [Bun](https://bun.sh/) (Claude Code が `bunx` で本スクリプトを起動する)

開発用 (本リポジトリで作業する場合):

- [mise](https://mise.jdx.dev/) — `mise.toml` で Bun / pnpm のバージョンを固定
- pnpm (パッケージマネージャ)

## 使い方

### Claude Code の hooks に設定

Claude Code の設定ファイル（`~/.claude/settings.json` または `.claude/settings.json`）に以下を記述：

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

### hook 設定ファイルを作成

hook の動作を制御する設定ファイルを作成する。以下のいずれかの場所に `hooks.config.json` を配置：

- `~/.claude/hooks.config.json`（ユーザー共通設定）
- `{プロジェクトルート}/.claude/hooks.config.json`（プロジェクト固有設定）

```json
[
  {
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
pnpm install

# 開発時の実行
pnpm run dev

# 開発時の実行（サンプル設定付き）
pnpm run dev:example

# カスタム入力/設定での実行
pnpm run dev --input my-input.json --config my-config.json

# lint (check)
pnpm run lint

# lint + format (auto-fix)
pnpm run fix

# test
pnpm run test

# typecheck
pnpm run typecheck
```

### プロジェクト構成

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
