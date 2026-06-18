export function trimAiText(value: unknown, maxLen: number): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

export function appendSearchContextToSystemPrompt(
  systemPrompt: string,
  searchContext: string
): string {
  const ctx = trimAiText(searchContext, 6000);
  if (!ctx) return systemPrompt;
  return `${systemPrompt}\n\n【Web検索結果（参考）】\n${ctx}\n\n上記を参考に、ユーザーの質問に答えてください。検索結果をそのまま貼り付けず、要約して伝えてください。`;
}
