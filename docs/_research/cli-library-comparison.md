# CLIライブラリ比較：Commander.js vs Yargs

## 概要

Claude Hooksプロジェクトに最適なCLIライブラリを選定するため、Commander.js 14.0.0とYargs 18.0.0を比較

## 1. オプショナル引数のサポート

### Commander.js

```typescript
// -d または -d file.log のパターンが簡単に実装可能
.option('-d, --debug [file]', 'debug mode', '/tmp/default.log')
```

**結果**:

- `-d` → `{ debug: true }`
- `-d file.log` → `{ debug: "file.log" }`
- デフォルト値未指定 → `{ debug: "/tmp/default.log" }`

**評価**: ⭐⭐⭐⭐⭐ 非常にシンプルで直感的

### Yargs

```typescript
// 標準的な実装では困難、手動パースが必要
.option('debug', {
  alias: 'd',
  describe: 'debug mode'
})
```

**結果**:

- 標準実装では `-d` のみのパターンが認識されない
- カスタムパースロジックの追加が必要

**評価**: ⭐⭐ 追加実装が必要で複雑

## 2. TypeScriptサポート

### Commander.js

- 基本的な型定義：組み込み
- 高度な型推論：`@commander-js/extra-typings`パッケージ
- TypeScript 5.0以上が必要

```typescript
import { program } from "@commander-js/extra-typings";
// オプションと引数が完全に型付けされる
```

**評価**: ⭐⭐⭐⭐⭐ 優れた型サポート

### Yargs

- 型定義：`@types/yargs`パッケージ
- 型推論：`parseSync()`使用で改善
- ESMファースト（v18.0.0から）

```typescript
import yargs from 'yargs/yargs';
const argv = yargs(hideBin(process.argv))
  .options({...})
  .parseSync(); // 型推論が向上
```

**評価**: ⭐⭐⭐⭐ 良好だが追加パッケージが必要

## 3. API設計と使いやすさ

### Commander.js

- メソッドチェーン式のシンプルなAPI
- 直感的なオプション定義
- アクションハンドラーが明確

```typescript
program.option("-d, --debug [file]").action((options) => {
  /* 処理 */
});
```

**評価**: ⭐⭐⭐⭐⭐ 非常に使いやすい

### Yargs

- より多機能だが複雑
- オプション定義が冗長
- 多くの設定項目

```typescript
yargs.options({
  debug: {
    alias: "d",
    describe: "debug mode",
    type: "string",
  },
});
```

**評価**: ⭐⭐⭐ 機能豊富だが学習曲線が急

## 4. 高度な機能

### Commander.js

- サブコマンド：✅ シンプルな実装
- バリデーション：✅ カスタム関数サポート
- ヘルプ：✅ 自動生成、カスタマイズ可能
- エラーハンドリング：✅ 組み込みサポート

**評価**: ⭐⭐⭐⭐ 必要十分な機能

### Yargs

- サブコマンド：✅ 高度なサポート
- バリデーション：✅ 豊富な組み込みバリデーター
- ヘルプ：✅ 高度なカスタマイズ
- ミドルウェア：✅ 独自機能
- 補完：✅ シェル補完サポート

**評価**: ⭐⭐⭐⭐⭐ 非常に多機能

## 5. パフォーマンスと依存関係

### Commander.js

- 依存関係：0個
- サイズ：軽量
- 起動速度：高速

**評価**: ⭐⭐⭐⭐⭐ 最小限で高速

### Yargs

- 依存関係：複数
- サイズ：大きめ
- 起動速度：やや遅い

**評価**: ⭐⭐⭐ 機能豊富だが重い

## 実装例の比較

### `-d`オプションの実装

**Commander.js**:

```typescript
program
  .option("-d, --debug [file]", "debug mode", "/tmp/debug.log")
  .action((options) => {
    if (options.debug === true) {
      // -d のみ
      debugFile = "/tmp/debug.log";
    } else {
      // -d file.log
      debugFile = options.debug;
    }
  });
```

**Yargs**:

```typescript
// 手動パースが必要
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-d") {
    if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
      debugValue = args[i + 1];
    } else {
      debugValue = true;
    }
  }
}
```

## 総合評価

### Commander.js

**長所**:

- オプショナル引数の優れたサポート
- シンプルで直感的なAPI
- 軽量で高速
- TypeScriptサポートが優秀
- 依存関係なし

**短所**:

- 高度な機能が限定的
- ミドルウェアサポートなし

**総合評価**: ⭐⭐⭐⭐⭐

### Yargs

**長所**:

- 非常に多機能
- 高度なバリデーション
- シェル補完サポート
- 大規模CLIアプリに適している

**短所**:

- オプショナル引数の扱いが複雑
- APIが冗長
- 依存関係が多い
- 学習曲線が急

**総合評価**: ⭐⭐⭐

## 結論

**Claude Hooksプロジェクトには Commander.js を推奨**

理由:

1. `-d [file]`パターンが自然にサポートされる
2. シンプルなAPIで保守性が高い
3. 依存関係がなく軽量
4. TypeScriptサポートが優秀
5. プロジェクトの要件に対して十分な機能

Yargsは大規模で複雑なCLIツールには適しているが、Claude Hooksのようなシンプルなツールには過剰
