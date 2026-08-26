export type ContextKind = 'changes' | 'commit' | 'file' | 'description'

export type InputRequest =
  | { kind: 'changes' }
  | { kind: 'commit'; ref: string }
  | { kind: 'file'; target: string }
  | { kind: 'description'; text: string }

/** Context that has been gathered and is ready to inject into the LLM prompt */
export interface GatheredContext {
  kind: ContextKind
  /** Short title for the document */
  title: string
  /** Source label, e.g. "local changes", "commit HEAD", "src/auth/" */
  sourceLabel: string
  /** Raw material (diff / file contents) to inject into the prompt */
  material: string
  /** Files involved (description/relevance modes only) */
  selectedFiles?: string[]
  truncated?: boolean
}
