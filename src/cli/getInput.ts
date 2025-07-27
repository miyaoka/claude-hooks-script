import { tryCatchAsync } from "../utils/result";

export async function getInput(inputOption?: string): Promise<string> {
  // 入力がTTY（端末）でない場合、パイプから標準入力を受け取る
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];

    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString();
  }

  // --inputが指定された場合
  if (inputOption) {
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

  // 引数なし: デフォルトのサンプルinputを使用
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
