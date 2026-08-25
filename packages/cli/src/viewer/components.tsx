import { createElement, isValidElement, type ReactNode } from 'react'

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

export function Block({ name, lines, children, open }: BlockProps) {
  return (
    <details className="cb-block" open={open}>
      <summary className="cb-block-summary">
        <span className="cb-block-name">{name}</span>
        {lines && <span className="cb-block-lines">{lines}</span>}
      </summary>
      <div className="cb-block-body">{children}</div>
    </details>
  )
}

interface CodeBlockProps {
  lang?: string
  children?: ReactNode
}

/**
 * Renders the code as a line-numbered, data-line-annotated block.
 * The actual syntax highlighting is applied later by the viewer's
 * post-processing (shiki) — here we preserve the exact source and
 * per-line anchors for note linking.
 */
export function CodeBlock({ lang, children }: CodeBlockProps) {
  const source = extractText(children)
  const lines = source.replace(/\n$/, '').split('\n')

  return (
    <div className="cb-code-wrap">
      {lang && <div className="cb-code-lang">{lang}</div>}
      <div className="cb-code" data-lang={lang ?? ''}>
        {lines.map((line, i) => (
          <div className="cb-code-line" data-line={i + 1} key={i}>
            <span className="cb-code-num">{i + 1}</span>
            <span className="cb-code-text">{line === '' ? '\u00A0' : line}</span>
          </div>
        ))}
      </div>
    </div>
  )
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
  const Component = docComponents[tag as keyof typeof docComponents]
  return Component ? createElement(Component, props as never, children) : null
}
