import { parseArgs as nodeParseArgs } from "node:util";

export type ParsedArgs = {
  debug?: string | boolean;
  help?: boolean;
  input?: string;
  config?: string;
};

export function parseArgs(): ParsedArgs {
  const args = Bun.argv.slice(2);

  // -d の特別処理のため、手動でチェック
  let debugValue: string | boolean | undefined;
  const debugIndex = args.findIndex((arg) => arg === "-d" || arg === "--debug");

  if (debugIndex !== -1) {
    const nextArg = args[debugIndex + 1];
    // 次の引数がオプションでなく、存在する場合はファイルパスとして扱う
    if (nextArg && !nextArg.startsWith("-")) {
      debugValue = nextArg;
      // 消費した引数を削除
      args.splice(debugIndex, 2);
    } else {
      debugValue = true;
      // フラグのみ削除
      args.splice(debugIndex, 1);
    }
  }

  // 残りの引数をparseArgs
  const { values } = nodeParseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      input: { type: "string", short: "i" },
      config: { type: "string", short: "c" },
    } as const,
    strict: true,
    allowPositionals: false,
  });

  return {
    ...values,
    debug: debugValue,
  };
}

export async function showHelpAndExit(): Promise<never> {
  const helpText = await Bun.file(
    new URL("../messages/help.txt", import.meta.url).pathname,
  ).text();
  console.log(helpText);
  process.exit(0);
}
