// Few-shot extraction prompt for NDAs. Source: docs/specs/key-term-extraction-spec.md.
// Term list duplicated from lib/config/standard-terms.ts (kept in sync manually)
// rather than imported, since that file uses the `@/` alias which Deno can't resolve.
const NDA_STANDARD_TERMS = [
  'Parties',
  'Effective Date',
  'Confidentiality Obligations',
  'Permitted Disclosures',
  'Term & Duration',
  'Governing Law',
  'Jurisdiction',
  'IP Ownership',
  'Non-Solicitation',
  'Breach & Remedy',
]

const FEW_SHOT_EXAMPLES = `
Example 1:
Input: "[PAGE 1]\\nThis Non-Disclosure Agreement is entered into as of March 1, 2025 between Northwind Traders and Contoso Ltd. This Agreement shall remain in effect for two (2) years from the Effective Date."
Output: {"terms":[{"term_name":"Parties","value":"Northwind Traders and Contoso Ltd","page_number":1,"confidence_score":95,"source_sentence":"This Non-Disclosure Agreement is entered into as of March 1, 2025 between Northwind Traders and Contoso Ltd."},{"term_name":"Effective Date","value":"March 1, 2025","page_number":1,"confidence_score":95,"source_sentence":"This Non-Disclosure Agreement is entered into as of March 1, 2025 between Northwind Traders and Contoso Ltd."},{"term_name":"Term & Duration","value":"2 years from the Effective Date","page_number":1,"confidence_score":90,"source_sentence":"This Agreement shall remain in effect for two (2) years from the Effective Date."}]}

Example 2:
Input: "[PAGE 2]\\nThis Agreement is governed by the laws of the State of New York. Any disputes shall be resolved in the courts of New York County."
Output: {"terms":[{"term_name":"Governing Law","value":"State of New York","page_number":2,"confidence_score":98,"source_sentence":"This Agreement is governed by the laws of the State of New York."},{"term_name":"Jurisdiction","value":"Courts of New York County","page_number":2,"confidence_score":95,"source_sentence":"Any disputes shall be resolved in the courts of New York County."}]}

Example 3:
Input: "[PAGE 1]\\nNeither party shall solicit the other's employees for a period of one year following termination."
Output: {"terms":[{"term_name":"Non-Solicitation","value":"1 year following termination","page_number":1,"confidence_score":92,"source_sentence":"Neither party shall solicit the other's employees for a period of one year following termination."}]}
`.trim()

export function buildNdaExtractionPrompt(customTerms: string[]): string {
  return `You are a contract analysis assistant. Extract the following key terms from the
provided NDA contract text. The text contains [PAGE N] markers indicating
page boundaries — use these to determine the page_number for each term.

Standard terms to extract: ${NDA_STANDARD_TERMS.join(', ')}
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
