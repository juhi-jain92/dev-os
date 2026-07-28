// Shared [PAGE N] marker parser used by the TextViewer fallback, the
// extraction prompt builder, and the chat context builder.
// Source: docs/specs/results-viewer-spec.md — Component Spec.

export interface PageSection {
  page: number
  content: string
}

const PAGE_MARKER = /\[PAGE (\d+)\]/g

export function parsePageMarkers(text: string): PageSection[] {
  const matches = [...text.matchAll(PAGE_MARKER)]

  if (matches.length === 0) {
    return [{ page: 1, content: text.trim() }]
  }

  return matches.map((match, index) => {
    const start = match.index! + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index! : text.length

    return {
      page: Number(match[1]),
      content: text.slice(start, end).trim(),
    }
  })
}
