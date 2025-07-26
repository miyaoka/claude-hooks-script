import { tryCatch } from "./result";

/**
 * パターンとテキストのマッチングを行う
 * パターンが有効な正規表現の場合は正規表現マッチ、そうでない場合は部分文字列マッチを行う
 */
export function matchPattern(pattern: string, text: string): boolean {
  const regexResult = tryCatch(() => new RegExp(pattern, "i"));

  if (regexResult.value) {
    // 有効な正規表現の場合（大文字小文字を無視）
    return regexResult.value.test(text);
  } else {
    // 無効な正規表現の場合は文字列として部分一致（大文字小文字を無視）
    return text.toLowerCase().includes(pattern.toLowerCase());
  }
}
