export interface ParsedCommand {
  command: string;
  args: string;
}

export function parseBashCommand(input: string): ParsedCommand[] {
  if (!input.trim()) {
    return [];
  }

  const commands: ParsedCommand[] = [];

  // クォート内の文字を一時的に置換して区切り文字を保護
  let processedInput = input;
  const quotes: string[] = [];
  let quoteIndex = 0;

  // シングルクォートとダブルクォートの内容を保護
  processedInput = processedInput.replace(/'[^']*'|"[^"]*"/g, (match) => {
    quotes.push(match);
    return `__QUOTE_${quoteIndex++}__`;
  });

  // &&, ;, | で分割
  const parts = processedInput.split(/\s*(?:&&|;|\|)\s*/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // クォートを復元
    let restored = trimmed;
    quotes.forEach((quote, i) => {
      restored = restored.replace(`__QUOTE_${i}__`, quote);
    });

    // コマンドと引数を分離
    const firstSpace = restored.indexOf(" ");
    if (firstSpace === -1) {
      commands.push({ command: restored, args: "" });
    } else {
      commands.push({
        command: restored.substring(0, firstSpace),
        args: restored.substring(firstSpace + 1).trim(),
      });
    }
  }

  return commands;
}
