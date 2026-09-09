// Extracts the trailing ```favie-summary fenced JSON block an agent run must end with.
export function extractFavieSummary(text: string): { raw: string; json: unknown } | { error: string } {
  const re = /```favie-summary\s*\n([\s\S]*?)\n```/g
  let last: RegExpExecArray | null = null
  for (let m = re.exec(text); m; m = re.exec(text)) last = m
  if (!last) return { error: 'no favie-summary fence found' }
  const raw = last[1].trim()
  try {
    return { raw, json: JSON.parse(raw) }
  } catch (e) {
    return { error: `favie-summary is not valid JSON: ${(e as Error).message}` }
  }
}
