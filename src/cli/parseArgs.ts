export type ParsedArgs = {
  debug?: string | boolean;
  help?: boolean;
  input?: string;
  config?: string;
};

const HELP_TEXT = `Claude Code hook script for intercepting tool usage

Usage: claude-hooks [options]

Options:
  -d, --debug [file]    Enable debug mode with optional log file
  -i, --input <file>    Input file path
  -c, --config <file>   Configuration file path
  -h, --help            Display help message
`;

// オプション名 → 正規化されたロングキー
const ALIAS: Record<string, string> = {
  "-d": "--debug",
  "-i": "--input",
  "-c": "--config",
  "-h": "--help",
  "--debug": "--debug",
  "--input": "--input",
  "--config": "--config",
  "--help": "--help",
};

function splitToken(token: string): { name: string; inline?: string } {
  if (token.startsWith("--")) {
    const eq = token.indexOf("=");
    if (eq !== -1) {
      return { name: token.slice(0, eq), inline: token.slice(eq + 1) };
    }
  }
  return { name: token };
}

function takeRequiredValue(
  name: string,
  inline: string | undefined,
  next: string | undefined,
): { value: string; consumedNext: boolean } {
  if (inline !== undefined) return { value: inline, consumedNext: false };
  if (next === undefined || next.startsWith("-")) {
    throw new Error(`Option ${name} requires a value`);
  }
  return { value: next, consumedNext: true };
}

function takeOptionalValue(
  inline: string | undefined,
  next: string | undefined,
): { value: string | true; consumedNext: boolean } {
  if (inline !== undefined) return { value: inline, consumedNext: false };
  if (next !== undefined && !next.startsWith("-")) {
    return { value: next, consumedNext: true };
  }
  return { value: true, consumedNext: false };
}

export function parseArgs(): ParsedArgs {
  const argv = Bun.argv.slice(2);
  const result: ParsedArgs = {};

  let i = 0;
  while (i < argv.length) {
    const token = argv[i];
    if (token === undefined) break;

    const { name, inline } = splitToken(token);
    const canonical = ALIAS[name];
    if (canonical === undefined) {
      throw new Error(`Unknown option: ${token}`);
    }

    const next = argv[i + 1];

    if (canonical === "--help") {
      if (inline !== undefined) {
        throw new Error(`Option --help does not take a value`);
      }
      result.help = true;
      i += 1;
      continue;
    }

    if (canonical === "--debug") {
      const { value, consumedNext } = takeOptionalValue(inline, next);
      result.debug = value;
      i += consumedNext ? 2 : 1;
      continue;
    }

    if (canonical === "--input") {
      const { value, consumedNext } = takeRequiredValue(
        canonical,
        inline,
        next,
      );
      result.input = value;
      i += consumedNext ? 2 : 1;
      continue;
    }

    if (canonical === "--config") {
      const { value, consumedNext } = takeRequiredValue(
        canonical,
        inline,
        next,
      );
      result.config = value;
      i += consumedNext ? 2 : 1;
      continue;
    }

    throw new Error(`Unhandled option: ${canonical}`);
  }

  return result;
}

export async function showHelpAndExit(): Promise<never> {
  console.log(HELP_TEXT);
  process.exit(0);
}
