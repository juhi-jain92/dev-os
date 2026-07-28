// Few-shot extraction prompt for MSAs. Source: docs/specs/key-term-extraction-spec.md.
// Term list duplicated from lib/config/standard-terms.ts (kept in sync manually)
// rather than imported, since that file uses the `@/` alias which Deno can't resolve.
const MSA_STANDARD_TERMS = [
  'Parties',
  'Service Scope',
  'Payment Terms',
  'Invoice Schedule',
  'Late Payment Penalty',
  'Liability Cap',
  'Indemnification',
  'IP Ownership',
  'Termination Clause',
  'Governing Law',
  'Dispute Resolution',
  'Notice Period',
]

const FEW_SHOT_EXAMPLES = `
Example 1:
Input: "[PAGE 1]\\nThis Master Services Agreement is entered into between Fabrikam Inc and Adventure Works Corp for the provision of consulting services. Payment shall be due within thirty (30) days of invoice date."
Output: {"terms":[{"term_name":"Parties","value":"Fabrikam Inc and Adventure Works Corp","page_number":1,"confidence_score":95,"source_sentence":"This Master Services Agreement is entered into between Fabrikam Inc and Adventure Works Corp for the provision of consulting services."},{"term_name":"Payment Terms","value":"Due within 30 days of invoice date","page_number":1,"confidence_score":93,"source_sentence":"Payment shall be due within thirty (30) days of invoice date."}]}

Example 2:
Input: "[PAGE 2]\\nLate payments shall accrue interest at 1.5% per month. Provider's total liability under this Agreement shall not exceed the fees paid in the preceding twelve months."
Output: {"terms":[{"term_name":"Late Payment Penalty","value":"1.5% interest per month","page_number":2,"confidence_score":90,"source_sentence":"Late payments shall accrue interest at 1.5% per month."},{"term_name":"Liability Cap","value":"Fees paid in the preceding 12 months","page_number":2,"confidence_score":94,"source_sentence":"Provider's total liability under this Agreement shall not exceed the fees paid in the preceding twelve months."}]}

Example 3:
Input: "[PAGE 1]\\nEither party may terminate this Agreement upon sixty (60) days written notice to the other party."
Output: {"terms":[{"term_name":"Termination Clause","value":"60 days written notice","page_number":1,"confidence_score":92,"source_sentence":"Either party may terminate this Agreement upon sixty (60) days written notice to the other party."},{"term_name":"Notice Period","value":"60 days","page_number":1,"confidence_score":90,"source_sentence":"Either party may terminate this Agreement upon sixty (60) days written notice to the other party."}]}
`.trim()

export function buildMsaExtractionPrompt(customTerms: string[]): string {
  return `You are a contract analysis assistant. Extract the following key terms from the
provided MSA contract text. The text contains [PAGE N] markers indicating
page boundaries — use these to determine the page_number for each term.

Standard terms to extract: ${MSA_STANDARD_TERMS.join(', ')}
Additional custom terms requested by the user: ${customTerms.length > 0 ? customTerms.join(', ') : 'none'}

For each term, return:
- term_name: the term as listed above
- value: the extracted value, verbatim or concisely paraphrased
- page_number: the 1-indexed page where this term appears (from [PAGE N] markers)
- confidence_score: your confidence this extraction is correct, 0.0-100.0
- source_sentence: the exact verbatim sentence from the contract this value was drawn from

If a term is not present in the document, still include it with value:
"Not found in document", confidence_score: 0, source_sentence: "".

Return ONLY a JSON object: { "terms": [ ... ] }. No prose, no markdown fences.

${FEW_SHOT_EXAMPLES}`
}
