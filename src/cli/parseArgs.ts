import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { program } from "@commander-js/extra-typings";

const __dirname = dirname(fileURLToPath(import.meta.url));

// パッケージのバージョンを取得
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8"),
);

export type ParsedArgs = {
  debug?: string | boolean;
  help?: boolean;
  input?: string;
  config?: string;
};

export function parseArgs(): ParsedArgs {
  program
    .version(packageJson.version)
    .description("Claude Code hook script for intercepting tool usage")
    .option("-d, --debug [file]", "Enable debug mode with optional log file")
    .option("-i, --input <file>", "Input file path")
    .option("-c, --config <file>", "Configuration file path")
    .option("-h, --help", "Display help message")
    .parse(Bun.argv);

  const options = program.opts();

  return options;
}

export async function showHelpAndExit(): Promise<never> {
  // Commander.jsのヘルプを表示
  program.help();
}
