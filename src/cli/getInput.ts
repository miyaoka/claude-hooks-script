import { tryCatchAsync } from "../utils/result";

async function readStdin(): Promise<string | null> {
  // 標準入力がTTY（端末）の場合、またはisTTYがundefinedの場合は、パイプされていない
  if (process.stdin.isTTY !== false) {
    return null;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString();
}

export async function getInput(inputOption?: string): Promise<string> {
  // 標準入力があるかチェック
  const stdinInput = await readStdin();
  if (stdinInput !== null) {
    // 標準入力がある場合（本番環境）
    return stdinInput;
  }

  // --inputが指定された場合
  if (inputOption) {
    if (inputOption === "-") {
      // 明示的に標準入力を指定したが、標準入力がない
      console.error(
        "No input provided via stdin. Use --help for usage information.",
      );
      process.exit(1);
    }

    const inputResult = await tryCatchAsync(() => Bun.file(inputOption).text());
    if (!inputResult.value) {
      console.error(`Error reading input file: ${inputOption}`);
      console.error(inputResult.error);
      process.exit(1);
    }

    console.log(`Input file: ${inputOption}`);
    console.log(inputResult.value);
    return inputResult.value;
  }

  // デフォルトのサンプル入力を使用（テストモードまたは引数なし実行）
  const defaultInputPath = new URL("../../examples/input.json", import.meta.url)
    .pathname;
  const defaultInputResult = await tryCatchAsync(() =>
    Bun.file(defaultInputPath).text(),
  );
  if (!defaultInputResult.value) {
    console.error(`Error reading default input file: ${defaultInputPath}`);
    console.error(
      `Please ensure the file exists or provide input via --input option`,
    );
    process.exit(1);
  }

  console.log(`Using default input: ${defaultInputPath}`);
  console.log(defaultInputResult.value);
  return defaultInputResult.value;
}
