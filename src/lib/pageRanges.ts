// Framework-free. Parse "1-3, 5, 8-10" into zero-based page indexes.
export function parsePageRanges(input: string, pageCount: number): number[] | null {
  const indexes = new Set<number>()
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return null
  for (const part of parts) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part)
    if (!m) return null
    const from = Number(m[1])
    const to = m[2] ? Number(m[2]) : from
    if (from < 1 || to > pageCount || from > to) return null
    for (let i = from; i <= to; i++) indexes.add(i - 1)
  }
  return [...indexes].sort((a, b) => a - b)
}
