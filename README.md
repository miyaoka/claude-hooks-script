# @miyaoka/claude-hooks

Claude Code 用の hook スクリプト

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

設定後、Claude Code がツールを使用する際に`/tmp/claude-hook-dump.jsonl`に hook の入力が JSONL 形式で記録されます。

```bash
# ログを確認
tail -f /tmp/claude-hook-dump.jsonl
```

## 開発

```bash
# 依存関係をインストール
bun install

## lint
bun run lint --fix

## test
bun run test

## typecheck
bun run typecheck
```
