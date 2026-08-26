import type { DocMeta } from './docs-meta'

export type { DocMeta }

export async function fetchDocs(): Promise<DocMeta[]> {
  const res = await fetch('/api/docs')
  if (!res.ok) throw new Error(`Failed to load document list (${res.status})`)
  return (await res.json()) as DocMeta[]
}

export interface FetchedDoc {
  ok: boolean
  html: string
  error?: string
  /** MDX compilation failed; html is a plain-markdown fallback render */
  degraded?: boolean
  files?: string[]
}

/** Fetch the document compiled to HTML by the server */
export async function fetchDocHtml(slug: string): Promise<FetchedDoc> {
  const res = await fetch(`/api/doc/${encodeURIComponent(slug)}`)
  if (!res.ok) {
    // still return the fallback shape so the UI shows a message + raw text
    return { ok: false, html: '', error: `HTTP ${res.status}` }
  }
  return (await res.json()) as FetchedDoc
}
