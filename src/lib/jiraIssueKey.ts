export function getJiraIssueKey(value: string): string | undefined {
  const input = value.trim();
  if (/^[a-z][a-z0-9_]*-\d+$/i.test(input)) return input.toUpperCase();
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:') return undefined;
    const match = url.pathname.match(/^\/browse\/([a-z][a-z0-9_]*-\d+)\/?$/i);
    return match?.[1].toUpperCase();
  } catch {
    return undefined;
  }
}
