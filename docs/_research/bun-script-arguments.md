# Bunスクリプト実行時の引数渡し仕様

## 概要

Bun v1.2.18での検証結果に基づく、`bun run`コマンドでスクリプトに引数を渡す際の仕様

## 調査結果

### 1. 基本的な引数渡し

`bun run <script> --arg value` の形式で直接引数を渡すことができる

```bash
# package.jsonに定義されたスクリプト
"scripts": {
  "dev": "bun run src/index.ts"
}

# 実行例
bun run dev --input test.json
# → src/index.tsに ["--input", "test.json"] が渡される
```

### 2. `--` セパレータについて

- Bunでは`--`セパレータは**必須ではない**
- 引数は自動的にスクリプトに渡される
- `--`を使っても使わなくても同じ結果になる

```bash
# これらは同じ結果
bun run test-args --input test.json
bun run test-args -- --input test.json
```

### 3. 引数へのアクセス方法

スクリプト内では以下の方法で引数にアクセス可能：

```typescript
// 標準的な方法（Node.js互換）
const args = process.argv.slice(2);

// Bun固有の方法
const args = Bun.argv.slice(2);
```

両方とも同じ結果を返す：

- `argv[0]`: Bunの実行パス
- `argv[1]`: スクリプトファイルのパス
- `argv[2]`以降: 渡された引数

### 4. 実行例

```bash
# オプション引数
bun run script --input file.json --debug true
# → ["--input", "file.json", "--debug", "true"]

# 位置引数
bun run script arg1 arg2 arg3
# → ["arg1", "arg2", "arg3"]

# 混在
bun run script arg1 --option value arg2
# → ["arg1", "--option", "value", "arg2"]
```

## 他のランタイムとの比較

- **npm/yarn**: `--`セパレータが必要（`npm run script -- --arg`）
- **pnpm**: `--`セパレータが必要（`pnpm run script -- --arg`）
- **Bun**: `--`セパレータ不要（`bun run script --arg`）

この違いはBunの設計思想による。Bunはより直感的な動作を目指している

## 注意事項

1. スクリプト名と同じBunの組み込みコマンドがある場合、組み込みコマンドが優先される
2. その場合は明示的に`bun run <script>`を使用する必要がある
3. 引数内のスペースや特殊文字は適切にエスケープまたはクォートする必要がある
