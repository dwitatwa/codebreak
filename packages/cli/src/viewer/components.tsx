import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'

/**
 * Extract plain text from MDX children. The code inside <CodeBlock> is parsed
 * by MDX as JSX (often a single <p> element), so we unwrap elements and
 * concatenate text nodes rather than String()ing the element.
 */
function extractText(node: ReactNode): string {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement(node)) {
    const el = node as { type?: unknown; props?: { children?: ReactNode } }
    // When the code is written as a fenced block inside <CodeBlock>, MDX
    // produces a <pre><code>...</code></pre>; unwrap it to the plain text.
    if (el.type === 'code' || el.type === 'pre') return extractText(el.props?.children)
    return extractText(el.props?.children)
  }
  return ''
}

/** Parse a "12-40" or "12" line range into [start, end] */
export function parseLineRange(range?: string): [number, number] | null {
  if (!range) return null
  const m = /^(\d+)(?:\s*[-–—]\s*(\d+))?$/.exec(range.trim())
  if (!m) return null
  const start = Number(m[1])
  const end = m[2] ? Number(m[2]) : start
  return [start, end]
}

/**
 * Viewer components that agents/LLMs write in their documents.
 * Server-rendered (SSR) into deterministic, classed HTML — the document
 * format and the viewer's rendering are the same contract.
 *
 * Layout: code FIRST (highlighted), line-keyed notes below it.
 * `data-line` attributes on both code lines and notes enable the
 * client-side hover linking in the viewer.
 */

interface BlockProps {
  name: string
  lines?: string
  children?: ReactNode
  /** Progressive disclosure: only the first block in a doc stays open */
  open?: boolean
}

/** Extract note text from a <Note> element child */
function extractNoteText(node: ReactNode): string {
  return extractText(node)
}

/**
 * Pull {line → note-text} out of a <LineNotes> child, and return the
 * remaining children (the <LineNotes> itself is consumed — its notes
 * become hover highlights on the code lines instead of a below-list).
 */
function splitNotes(children: ReactNode): { notes: Map<string, string>; rest: ReactNode[] } {
  const notes = new Map<string, string>()
  const rest: ReactNode[] = []
  const walk = (node: ReactNode): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (isValidElement(node)) {
      const el = node as { type?: unknown; props?: { children?: ReactNode; line?: unknown } }
      if (el.type === LineNotes) {
        walk(el.props?.children)
        return
      }
      if (el.type === Note) {
        const line = String(el.props?.line ?? '')
        if (line) notes.set(line, extractNoteText(el.props?.children))
        return
      }
    }
    rest.push(node)
  }
  walk(children)
  return { notes, rest }
}

export function Block({ name, lines, children, open }: BlockProps) {
  const range = parseLineRange(lines)
  const start = range?.[0]

  // Pull notes out; the <LineNotes> is consumed into hover-highlights
  const { notes, rest } = splitNotes(children)
  const body = (Array.isArray(rest) ? rest : [rest])
    .filter((c) => c !== null && c !== undefined)
    .map((c) => (isValidElement(c) ? cloneCodeBlockWithNotes(c, start, notes) : c))

  return (
    <details className="cb-block" open={open}>
      <summary className="cb-block-summary">
        <span className="cb-block-name">{name}</span>
        {lines && <span className="cb-block-lines">{lines}</span>}
      </summary>
      <div className="cb-block-body">{body}</div>
    </details>
  )
}

interface CodeBlockProps {
  lang?: string
  /** First line number shown in the gutter — the real file line */
  start?: number
  /** line → note text, applied as hover highlights on the code lines */
  notes?: Map<string, string>
  children?: ReactNode
}

/**
 * Renders the code as a line-numbered, data-line-annotated block.
 * Lines that have a note get a highlight + data-note so hovering shows the
 * explanation right on the line (tooltip handled client-side).
 */
export function CodeBlock({ lang, start = 1, notes, children }: CodeBlockProps) {
  const source = extractText(children)
  const lines = source.replace(/\n$/, '').split('\n')

  return (
    <div className="cb-code-wrap">
      {lang && <div className="cb-code-lang">{lang}</div>}
      <div className="cb-code" data-lang={lang ?? ''}>
        {lines.map((line, i) => {
          const n = start + i
          const note = notes?.get(String(n))
          return (
            <div
              className={`cb-code-line${note ? ' cb-code-line--noted' : ''}`}
              data-line={n}
              data-note={note ?? undefined}
              key={i}
            >
              <span className="cb-code-num">{n}</span>
              <span className="cb-code-text">{line === '' ? '\u00A0' : line}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * If a child is a <CodeBlock>, forward the block's start line and the
 * extracted notes map so the gutter numbers match the file and noted
 * lines get their hover highlight.
 */
function cloneCodeBlockWithNotes(child: ReactElement, start?: number, notes?: Map<string, string>): ReactNode {
  if (child.type === CodeBlock) {
    return createElement(
      CodeBlock,
      { ...(child.props as object), start, notes },
      (child.props as { children?: ReactNode }).children,
    )
  }
  return child
}

interface LineNotesProps {
  children?: ReactNode
}

export function LineNotes({ children }: LineNotesProps) {
  return <div className="cb-notes">{children}</div>
}

interface NoteProps {
  line?: number | string
  children?: ReactNode
}

export function Note({ line, children }: NoteProps) {
  return (
    <div className="cb-note" data-line={String(line ?? '')}>
      {line !== undefined && <span className="cb-note-line">L{line}</span>}
      <span className="cb-note-text">{children}</span>
    </div>
  )
}

/** The components map consumed by the MDX evaluator */
export const docComponents = {
  Block,
  CodeBlock,
  LineNotes,
  Note,
}

export function renderComponent(tag: string, props: Record<string, unknown>, children?: ReactNode) {
  const Component = docComponents[tag as keyof typeof docComponents] as
    | React.ComponentType<Record<string, unknown>>
    | undefined
  return Component ? createElement(Component, props, children) : null
}
