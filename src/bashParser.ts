export interface ParsedCommand {
  command: string;
  args: string;
}

const QUOTE_REGEX = /'[^']*'|"[^"]*"/g;
// $(...) は内側に ) を含まない範囲だけ。ネストは扱わない（限界として受け入れる）
const SUBSTITUTION_REGEX = /\$\(([^)]*)\)|`([^`]*)`/g;
// &&, ||, ;, |, & の順で alternation。長いマッチ優先のため &&/|| を | / & より先に並べる
// 末尾の & は redirect 構文 (>&N / N>&N / &> / &>>) と衝突するため、
// `&` の直前または直後が `>` のときだけ分離禁止。
// bash 仕様では `&` 直前が `>` → redirect、`&` 直前が数字や空白 → background なので、
// 直前数字を排除すると `sleep 0& rm` のような background 化が捕捉できなくなる
const SEPARATOR_REGEX = /\s*(?:&&|\|\||;|\||(?<!>)&(?!>))\s*/;

/**
 * Bashコマンド文字列を個別コマンドに分解する。
 * - `&&` / `||` / `;` / `|` / `&` でトップレベルを分割
 * - `$(...)` とバッククォートで囲まれた command substitution の中身も独立コマンドとして抽出
 * - クォート内の区切り文字はリテラル扱い
 */
export function parseBashCommand(input: string): ParsedCommand[] {
  if (!input.trim()) return [];

  const substitutions: string[] = [];
  const withoutSubst = input.replace(
    SUBSTITUTION_REGEX,
    (_, paren?: string, backtick?: string) => {
      substitutions.push(paren ?? backtick ?? "");
      // substitution は外側コマンドから完全に除去（外側 args を汚さない）
      return "";
    },
  );

  // クォート内の区切り文字を保護
  const quotes: string[] = [];
  let quoteIndex = 0;
  const processed = withoutSubst.replace(QUOTE_REGEX, (match) => {
    quotes.push(match);
    return `__QUOTE_${quoteIndex++}__`;
  });

  const commands: ParsedCommand[] = [];
  for (const part of processed.split(SEPARATOR_REGEX)) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    let restored = trimmed;
    quotes.forEach((q, i) => {
      restored = restored.replace(`__QUOTE_${i}__`, q);
    });
    commands.push(splitCommand(restored));
  }

  // command substitution の中身を再帰的に展開して結果に加える
  for (const sub of substitutions) {
    commands.push(...parseBashCommand(sub));
  }

  return commands;
}

function splitCommand(input: string): ParsedCommand {
  const firstSpace = input.indexOf(" ");
  if (firstSpace === -1) {
    return { command: input, args: "" };
  }
  return {
    command: input.substring(0, firstSpace),
    args: input.substring(firstSpace + 1).trim(),
  };
}
