export type ContextKind = 'changes' | 'commit' | 'file' | 'description'

export type InputRequest =
  | { kind: 'changes' }
  | { kind: 'commit'; ref: string }
  | { kind: 'file'; target: string }
  | { kind: 'description'; text: string }

/** Konteks yang sudah dikumpulkan dan siap dimasukkan ke prompt LLM */
export interface GatheredContext {
  kind: ContextKind
  /** Judul singkat untuk dokumen */
  title: string
  /** Label sumber, mis. "local changes", "commit HEAD", "src/auth/" */
  sourceLabel: string
  /** Material mentah (diff / isi file) yang akan di-inject ke prompt */
  material: string
  /** File yang dilibatkan (khusus mode description/relevance) */
  selectedFiles?: string[]
  truncated?: boolean
}
