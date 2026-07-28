// PDF text extraction with [PAGE N] markers, used by the upload-contract
// Edge Function. Source: docs/specs/upload-extraction-spec.md.
// deno-lint-ignore-file no-explicit-any
// @ts-nocheck -- pdf-parse has no types; this file runs only in the Deno Edge Function runtime.
import pdfParse from 'npm:pdf-parse@1.1.1'

export interface ExtractedContract {
  text: string
  pageCount: number
  wordCount: number
  estimatedTokens: number
}

export async function extractContractText(fileBuffer: Uint8Array): Promise<ExtractedContract> {
  const pages: string[] = []

  await pdfParse(fileBuffer, {
    pagerender: async (pageData: any) => {
      const textContent = await pageData.getTextContent()
      const text = textContent.items.map((item: any) => item.str).join(' ')
      pages.push(text)
      return text
    },
  })

  const text = pages.map((content, index) => `[PAGE ${index + 1}]\n${content.trim()}`).join('\n\n')
  const wordCount = text
    .replace(/\[PAGE \d+\]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  const estimatedTokens = Math.ceil(text.length / 4)

  return { text, pageCount: pages.length, wordCount, estimatedTokens }
}
