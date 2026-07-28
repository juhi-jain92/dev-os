// Post-parse validation for process-extraction output — never trust the
// model's output shape blindly. Source: docs/specs/key-term-extraction-spec.md.
export interface ExtractedTerm {
  term_name: string
  value: string
  page_number: number
  confidence_score: number
  source_sentence: string
}

export function parseExtractionResponse(raw: string): unknown[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('terms' in parsed) ||
    !Array.isArray((parsed as { terms: unknown }).terms)
  ) {
    return null
  }

  return (parsed as { terms: unknown[] }).terms
}

export function validateTerms(terms: unknown[], pageCount: number): ExtractedTerm[] {
  const valid: ExtractedTerm[] = []

  for (const term of terms) {
    if (typeof term !== 'object' || term === null) continue
    const t = term as Record<string, unknown>

    if (typeof t.term_name !== 'string' || !t.term_name || typeof t.source_sentence !== 'string') {
      continue // drop and log — missing required fields
    }

    const confidence = typeof t.confidence_score === 'number' ? t.confidence_score : 0
    const clampedConfidence = Math.max(0, Math.min(100, confidence))

    const page = typeof t.page_number === 'number' ? t.page_number : 1
    const clampedPage = Math.max(1, Math.min(pageCount, page))

    valid.push({
      term_name: t.term_name,
      value: typeof t.value === 'string' ? t.value : 'Not found in document',
      page_number: clampedPage,
      confidence_score: clampedConfidence,
      source_sentence: t.source_sentence,
    })
  }

  return valid
}
