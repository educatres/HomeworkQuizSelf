import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { sha256 } from '../domain/canonical'
import type { SourceDocument } from '../domain/types'

GlobalWorkerOptions.workerSrc = workerUrl

export async function parsePdf(name: string, bytes: ArrayBuffer | Uint8Array): Promise<SourceDocument> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const source_sha256 = await sha256(new TextDecoder('latin1').decode(data))
  const task = getDocument({ data, isEvalSupported: false })
  const blocks: SourceDocument['blocks'] = []
  try {
    const pdf = await task.promise
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent()
      const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim()
      if (text) blocks.push({ block_id: `P${String(page).padStart(3, '0')}`, text, page, kind: 'page' })
    }
  } finally {
    await task.destroy()
  }
  const text = blocks.map(block => block.text).join('\n\n')
  const warnings = text ? [] : ['PDF 沒有可擷取文字，請改用可選取文字的 PDF 或文字檔。']
  return { id: crypto.randomUUID(), file_name: name, file_type: 'pdf', text, source_sha256, blocks, warnings, needs_review: !text }
}

