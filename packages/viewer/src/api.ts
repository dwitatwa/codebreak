import type { DocMeta } from './docs-meta'

export type { DocMeta }

export async function fetchDocs(): Promise<DocMeta[]> {
  const res = await fetch('/api/docs')
  if (!res.ok) throw new Error(`Gagal memuat daftar dokumen (${res.status})`)
  return (await res.json()) as DocMeta[]
}

export interface FetchedDoc {
  ok: boolean
  html: string
  error?: string
}

/** Ambil dokumen yang sudah dikompilasi server menjadi HTML */
export async function fetchDocHtml(slug: string): Promise<FetchedDoc> {
  const res = await fetch(`/api/doc/${encodeURIComponent(slug)}`)
  if (!res.ok) {
    // tetap kembalikan bentuk fallback agar UI menampilkan pesan + teks mentah
    return { ok: false, html: '', error: `HTTP ${res.status}` }
  }
  return (await res.json()) as FetchedDoc
}
