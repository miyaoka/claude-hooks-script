import { parseArgs as nodeParseArgs } from "node:util";

export type ParsedArgs = {
  debug?: boolean;
  help?: boolean;
  input?: string;
  config?: string;
};

export function parseArgs(): ParsedArgs {
  const { values } = nodeParseArgs({
    args: Bun.argv.slice(2),
    options: {
      debug: { type: "boolean", short: "d" },
      help: { type: "boolean", short: "h" },
      input: { type: "string", short: "i" },
      config: { type: "string", short: "c" },
    } as const,
    strict: true,
    allowPositionals: false,
  });

  return values;
}

export async function showHelpAndExit(): Promise<never> {
  const helpText = await Bun.file(
    new URL("../messages/help.txt", import.meta.url).pathname,
  ).text();
  console.log(helpText);
  process.exit(0);
}
