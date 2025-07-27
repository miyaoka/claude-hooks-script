# util.parseArgs でのオプショナル値実装方法

## 調査結果サマリー

Node.js の `util.parseArgs` は 2025年1月時点でオプショナル値をネイティブサポートしていない

- boolean型: 値を取らない（フラグのみ）
- string型: 必ず値が必要
- オプショナル値のサポートはGitHub Issue #53427で提案されたが、"wontfix"として却下された

## 実装方法: tokensを使用したカスタムパース

### 基本的なアプローチ

1. `tokens: true` を設定してトークン情報を取得
2. トークンを解析して、次のトークンがオプション値かどうかを判定
3. カスタムロジックで値の有無を処理

### 実装例

```typescript
import { parseArgs } from "node:util";

interface DebugOption {
  enabled: boolean;
  logFile?: string;
}

function parseDebugOption(args: string[]): DebugOption {
  // 基本的なオプション定義（boolean型として定義）
  const options = {
    debug: {
      type: "boolean" as const,
      short: "d",
    },
  };

  // tokensを有効にしてパース
  const { tokens } = parseArgs({
    args,
    options,
    tokens: true,
    allowPositionals: true,
  });

  let debugOption: DebugOption = { enabled: false };

  // トークンを順に処理
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.kind === "option" && token.name === "debug") {
      debugOption.enabled = true;

      // 次のトークンをチェック
      const nextToken = tokens[i + 1];

      // 次のトークンが positional かつオプションのように見えない場合は値として扱う
      if (
        nextToken?.kind === "positional" &&
        !nextToken.value.startsWith("-")
      ) {
        debugOption.logFile = nextToken.value;
        // このトークンを消費したことをマーク（実際の実装では別の方法で管理）
      }
    }
  }

  return debugOption;
}

// 使用例
console.log(parseDebugOption(["-d"]));
// => { enabled: true }

console.log(parseDebugOption(["-d", "custom.log"]));
// => { enabled: true, logFile: 'custom.log' }

console.log(parseDebugOption(["--debug", "debug.log", "other-arg"]));
// => { enabled: true, logFile: 'debug.log' }
```

### より堅牢な実装

```typescript
import { parseArgs, ParseArgsConfig } from "node:util";

interface OptionalStringOption {
  name: string;
  short?: string;
  defaultValue?: string;
  defaultIfNoArg?: string; // 引数なしの場合のデフォルト値
}

function parseArgsWithOptionalValues(
  args: string[],
  optionalOptions: OptionalStringOption[],
  otherOptions: ParseArgsConfig["options"] = {},
) {
  // オプショナル値オプションをbooleanとして登録
  const options: ParseArgsConfig["options"] = { ...otherOptions };
  const optionalMap = new Map<string, OptionalStringOption>();

  for (const opt of optionalOptions) {
    options[opt.name] = {
      type: "boolean",
      short: opt.short,
    };
    optionalMap.set(opt.name, opt);
    if (opt.short) {
      optionalMap.set(opt.short, opt);
    }
  }

  // パース実行
  const { values, positionals, tokens } = parseArgs({
    args,
    options,
    tokens: true,
    allowPositionals: true,
  });

  // カスタム値の処理
  const customValues: Record<string, string | boolean> = { ...values };
  const consumedIndices = new Set<number>();

  tokens.forEach((token, i) => {
    if (token.kind === "option") {
      const optConfig = optionalMap.get(token.name);
      if (optConfig && values[token.name]) {
        const nextToken = tokens[i + 1];

        // 次のトークンが値として使えるか判定
        if (
          nextToken?.kind === "positional" &&
          !nextToken.value.startsWith("-") &&
          !consumedIndices.has(nextToken.index)
        ) {
          customValues[optConfig.name] = nextToken.value;
          consumedIndices.add(nextToken.index);
        } else if (optConfig.defaultIfNoArg) {
          customValues[optConfig.name] = optConfig.defaultIfNoArg;
        }
      }
    }
  });

  // 消費されたpositionalを除外
  const filteredPositionals = positionals.filter((_, index) => {
    const tokenIndex = tokens.findIndex(
      (t) => t.kind === "positional" && t.index === index,
    );
    return !consumedIndices.has(index);
  });

  return {
    values: customValues,
    positionals: filteredPositionals,
  };
}

// 使用例
const result = parseArgsWithOptionalValues(
  process.argv.slice(2),
  [
    {
      name: "debug",
      short: "d",
      defaultIfNoArg: "debug.log",
    },
  ],
  {
    verbose: { type: "boolean", short: "v" },
    output: { type: "string", short: "o" },
  },
);
```

## 代替案

### 1. 複数のオプションを使用

```typescript
const options = {
  debug: { type: "boolean", short: "d" },
  "debug-file": { type: "string" },
};

// 使い方:
// -d                    # デバッグ有効（デフォルトファイル）
// -d --debug-file custom.log  # デバッグ有効（カスタムファイル）
```

### 2. 環境変数との組み合わせ

```typescript
const debugEnabled = values.debug;
const debugFile = debugEnabled
  ? process.env.DEBUG_FILE || "debug.log"
  : undefined;
```

### 3. サードパーティライブラリの使用

- Commander.js
- Yargs
- minimist

これらのライブラリはオプショナル値をネイティブサポートしている

## まとめ

`util.parseArgs`でオプショナル値を実装するには：

1. `tokens: true`を使用してトークン情報を取得
2. カスタムロジックで次のトークンを値として解釈
3. 消費したpositionalトークンを追跡して除外

ただし、複雑な要件がある場合は、Commander.jsなどの専用ライブラリの使用を検討すべき
