# @miyaoka/claude-hooks

Claude Code用のhookスクリプト

## インストール

```bash
# グローバルにインストール（推奨）
bun add -g @miyaoka/claude-hooks

# または npxで直接実行
bunx @miyaoka/claude-hooks
```

## 設定方法

Claude Codeの設定ファイル（`~/.claude/settings.json`または`.claude/settings.json`）に以下のように記述：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bunx @miyaoka/claude-hooks",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### 特定のツールのみに適用する場合

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
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

### 複数のツールに適用する場合

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit",
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

設定後、Claude Codeがツールを使用する際に`/tmp/claude-hook-dump.jsonl`にhookの入力がJSONL形式で記録されます。

```bash
# ログを確認
tail -f /tmp/claude-hook-dump.jsonl
```

## 開発

```bash
# リポジトリをクローン
git clone https://github.com/miyaoka/claude-hook-script.git
cd claude-hook-script

# 依存関係をインストール
bun install

# テスト
bun test

# ローカルでリンク
bun link
```
