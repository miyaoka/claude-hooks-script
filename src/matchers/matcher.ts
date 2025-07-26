export function matchTool(matcher: string | undefined, toolName: string): boolean {
  // 空文字またはundefinedはすべてにマッチ
  if (!matcher) {
    return true;
  }

  try {
    // 正規表現として評価
    const regex = new RegExp(`^${matcher}$`);
    return regex.test(toolName);
  } catch {
    // 無効な正規表現の場合は文字列として完全一致で比較
    return matcher === toolName;
  }
}