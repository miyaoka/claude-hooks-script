import { loadConfig } from "../config";
import type { HookConfig } from "../types/userConfig";
import { tryCatchAsync } from "../utils/result";

export async function getConfig(configOption?: string): Promise<HookConfig> {
  // --configが指定された場合
  if (configOption) {
    const configResult = await tryCatchAsync(async () => {
      const configContent = await Bun.file(configOption).text();
      console.log(`Config file: ${configOption}`);
      console.log(configContent);
      return JSON.parse(configContent);
    });
    if (!configResult.value) {
      console.error(`Error reading config file: ${configOption}`);
      console.error(configResult.error);
      process.exit(1);
    }
    return configResult.value;
  }

  // デフォルトの設定読み込み
  const config = loadConfig(process.cwd());
  if (config.length === 0) {
    const noConfigError = await Bun.file(
      new URL("../messages/no-config-error.txt", import.meta.url).pathname,
    ).text();
    console.error(noConfigError);
    process.exit(1);
  }

  return config;
}
