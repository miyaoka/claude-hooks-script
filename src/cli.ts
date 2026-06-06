import { appendFile } from "node:fs/promises";
import { loadConfig, validateConfig } from "./config";
import { tryCatchAsync } from "./result";
import type { HookConfig } from "./types";

export type ParsedArgs = {
  debug?: string | boolean;
  help?: boolean;
  input?: string;
  config?: string;
};

const HELP_TEXT = `Claude Code hook script for Bash command checking

Usage: claude-hooks [options]

Options:
  -d, --debug [file]    Enable debug mode with optional log file
  -i, --input <file>    Input file path
  -c, --config <file>   Configuration file path
  -h, --help            Display help message
`;

const NO_CONFIG_ERROR = `Error: No valid configuration found
Searched paths:
- $CLAUDE_CONFIG_DIR/hooks.config.json
- $HOME/.config/claude/hooks.config.json
- $HOME/.claude/hooks.config.json
- {project}/.claude/hooks.config.json

Use --config to specify a config file explicitly
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

// --- argument parsing ----------------------------------------------------

function splitToken(token: string): { name: string; inline?: string } {
  if (!token.startsWith("--")) return { name: token };
  const eq = token.indexOf("=");
  if (eq === -1) return { name: token };
  return { name: token.slice(0, eq), inline: token.slice(eq + 1) };
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

// --- input / config loading ---------------------------------------------

export async function getInput(inputOption?: string): Promise<string> {
  // --input指定（最優先）
  if (inputOption) {
    const inputResult = await tryCatchAsync(() => Bun.file(inputOption).text());
    if (!inputResult.value) {
      console.error(`Error reading input file: ${inputOption}`);
      console.error(inputResult.error);
      process.exit(1);
    }
    // hookの本番stdoutは JSON object のみに保つため診断は stderr に流す
    console.error(`Input file: ${inputOption}`);
    console.error(inputResult.value);
    return inputResult.value;
  }

  // パイプ経由の入力（本番：Claude Codeからのstdin）
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString();
  }

  // デフォルト: サンプル入力
  const defaultInputPath = new URL("../examples/input.json", import.meta.url)
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
  console.error(`Using default input: ${defaultInputPath}`);
  console.error(defaultInputResult.value);
  return defaultInputResult.value;
}

export async function getConfig(configOption?: string): Promise<HookConfig> {
  // --config指定
  if (configOption) {
    const configResult = await tryCatchAsync(async () => {
      const content = await Bun.file(configOption).text();
      // hookの本番stdoutは JSON object のみに保つため診断は stderr に流す
      console.error(`Config file: ${configOption}`);
      console.error(content);
      return JSON.parse(content);
    });
    if (!configResult.value) {
      console.error(`Error reading config file: ${configOption}`);
      console.error(configResult.error);
      process.exit(1);
    }
    if (!validateConfig(configResult.value)) {
      console.error(`Config validation failed for ${configOption}`);
      process.exit(1);
    }
    return configResult.value;
  }

  // 標準パスからロード
  const config = loadConfig(process.cwd());
  if (config.length === 0) {
    console.error(NO_CONFIG_ERROR);
    process.exit(1);
  }
  return config;
}

// --- debug ---------------------------------------------------------------

let debugMode = false;
let debugLogPath = "/tmp/claude-hooks-debug.log";

export function initDebugMode(cliDebug: string | boolean): void {
  debugMode = true;
  if (typeof cliDebug === "string") {
    debugLogPath = cliDebug;
  }
}

export function isDebugMode(): boolean {
  return debugMode;
}

export async function debugLog(message: string): Promise<void> {
  if (!debugMode) return;

  const timestamp = new Date().toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  await appendFile(debugLogPath, `[${timestamp}] ${message}\n`);
}
