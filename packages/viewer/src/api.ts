import type { ComponentType } from 'react'

export interface DocMeta {
  slug: string
  title: string
  type: string
  date: string
  source: string
}

export async function fetchDocs(): Promise<DocMeta[]> {
  const res = await fetch('/api/docs')
  if (!res.ok) throw new Error(`Gagal memuat daftar dokumen (${res.status})`)
  return (await res.json()) as DocMeta[]
}

/** Dynamic import modul MDX yang dikompilasi plugin vite kustom */
export function loadDocModule(
  slug: string,
): Promise<{ default: ComponentType | null; __error?: string }> {
  return import(/* @vite-ignore */ `${'/@codebreak-doc/'}${encodeURIComponent(slug)}.mdx`)
}
