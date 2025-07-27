# CLIライブラリ選定ドキュメント

調査日: 2025-07-27

## 調査結果サマリー

### 各ライブラリの最新バージョン（2025年7月時点）

| ライブラリ   | バージョン | Node.js要件              | バンドルサイズ | TypeScript      | 最終更新 |
| ------------ | ---------- | ------------------------ | -------------- | --------------- | -------- |
| commander.js | v14.0.0    | v20+                     | 174 KB         | ネイティブ      | 2ヶ月前  |
| yargs        | v18.0.0    | v20.19.0+/v22.12.0+/v23+ | 290 KB         | ネイティブ      | 2ヶ月前  |
| minimist     | v1.2.8     | なし                     | ~10 KB         | @types/minimist | 2年前    |

## 詳細比較

### 1. Node.js標準 parseArgs（現在の実装）

**メリット**

- 外部依存なし
- Node.js v18.3.0から標準機能
- シンプルな用途には十分

**デメリット**

- オプショナル引数のネイティブサポートなし
- 手動でargv操作が必要
- 機能が限定的

### 2. Commander.js

**メリット**

- TypeScriptネイティブサポート
- 中規模バンドルサイズ（174 KB）
- アクティブな開発（最新更新: 2ヶ月前）
- オプショナル引数サポート: `--option [value]`
- Bunとの互換性良好

**デメリット**

- Node.js v20以上が必要
- 型推論がyargsより劣る

**オプショナル引数の実装例**

```typescript
import { program } from "commander";

program
  .option("-d, --debug [file]", "enable debug mode", (value) => {
    if (value === true) return true;
    return value || "/tmp/claude-hooks-debug.log";
  })
  .parse();
```

### 3. Yargs

**メリット**

- 最も高度なTypeScript型推論
- 豊富な機能（バリデーション、ローカライゼーション等）
- アクティブな開発（最新更新: 2ヶ月前）
- Bunサポート（修正済み）

**デメリット**

- 最大のバンドルサイズ（290 KB）
- Node.js v20.19.0以上が必要
- 非同期コマンドの型が複雑

**オプショナル引数の実装例**

```typescript
import yargs from "yargs";

const argv = yargs(process.argv.slice(2))
  .option("debug", {
    alias: "d",
    type: "string",
    description: "Enable debug mode",
    coerce: (arg) => (arg === true ? "/tmp/claude-hooks-debug.log" : arg),
  })
  .parseSync();
```

### 4. Minimist

**メリット**

- 極小のバンドルサイズ（~10 KB）
- シンプルで高速
- 依存関係なし

**デメリット**

- 2年間更新なし
- TypeScriptサポートは外部型定義のみ
- 機能が基本的なもののみ
- オプショナル引数の公式サポートなし

## 推奨事項

### 本プロジェクトへの推奨: **Commander.js**

**理由**

1. **バンドルサイズのバランス**: 174 KBは配布用CLIツールとして許容範囲
2. **TypeScriptネイティブサポート**: 型定義が組み込まれており追加パッケージ不要
3. **オプショナル引数の優れたサポート**: `--option [value]`構文で直感的に実装可能
4. **アクティブなメンテナンス**: 2ヶ月前に最新版リリース
5. **Bun互換性**: 問題なく動作することが確認されている
6. **移行の容易さ**: 現在の手動実装から簡潔なコードへ移行可能

### 次点: Yargs

より複雑なCLIアプリケーションに成長する可能性がある場合は検討価値あり

### 非推奨: Minimist

メンテナンスが停滞しており、TypeScriptサポートも外部依存となるため非推奨

## 実装方針

Commander.jsを採用することで、現在の複雑な手動実装を以下のように簡潔にできる：

```typescript
// 現在の実装（複雑）
const debugIndex = args.findIndex((arg) => arg === "-d" || arg === "--debug");
// ... 手動でargv操作 ...

// Commander.js実装（簡潔）
program.option("-d, --debug [file]", "Enable debug mode").parse();

const debugFile =
  program.opts().debug === true
    ? "/tmp/claude-hooks-debug.log"
    : program.opts().debug;
```

これにより、コードの可読性と保守性が大幅に向上する
