import { tryCatch } from "./result";

/**
 * パターンとテキストのマッチングを行う
 * パターンが有効な正規表現の場合は正規表現マッチ、そうでない場合は部分文字列マッチを行う
 */
export function matchPattern(pattern: string, text: string): boolean {
  const regexResult = tryCatch(() => new RegExp(pattern, "i"));

  if (regexResult.value) {
    return regexResult.value.test(text);
  }
  return text.toLowerCase().includes(pattern.toLowerCase());
}
