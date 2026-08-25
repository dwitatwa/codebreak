import { evaluate } from '@mdx-js/mdx'
import * as jsxRuntime from 'react/jsx-runtime'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import { createHighlighter, type Highlighter } from 'shiki'
import { docComponents } from './components.js'

let highlighterPromise: Promise<Highlighter> | undefined

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ['github-dark'],
    langs: [
      'typescript', 'tsx', 'javascript', 'jsx', 'json', 'bash', 'shell',
      'python', 'go', 'rust', 'java', 'ruby', 'php', 'c', 'cpp', 'csharp',
      'swift', 'kotlin', 'html', 'css', 'scss', 'yaml', 'toml', 'markdown', 'sql', 'diff',
    ],
  })
  return highlighterPromise
}

export interface RenderedDoc {
  ok: boolean
  html: string
  error?: string
}

/**
 * Post-process the compiled HTML for LEGACY documents that still use
 * native <details>/<b> HTML instead of the new viewer components.
 * New component-based docs are already deterministic — this only applies
 * to old docs so they keep working as-is.
 *
 * 1. Label What/Why/Details paragraphs with cb-label classes.
 * 2. Collapse blocks: keep the first open, collapse the rest.
 */
export function postProcessHtml(html: string): string {
  let out = html.replace(
    /(?:<p>)?<strong>(What|Why|Details)<\/strong>(?:<\/p>)?|<b>(What|Why|Details)<\/b>/g,
    (_m, a: string, b: string) => {
      const label = a ?? b
      return `<div class="cb-label cb-label-${label.toLowerCase()}">${label}</div>`
    },
  )

  let first = true
  out = out.replace(/<details open>/g, () => {
    const open = first ? ' open' : ''
    first = false
    return `<details${open}>`
  })

  return out
}

/**
 * Compile MDX → HTML string in-process (Bun).
 *
 * The document can use either:
 *  - the viewer components (<Block>, <CodeBlock>, <LineNotes>, <Note>),
 *    resolved through the components map, or
 *  - legacy plain HTML/markdown (old docs), which renders as today.
 */
export async function renderDoc(raw: string): Promise<RenderedDoc> {
  try {
    const highlighter = await getHighlighter()
    const { default: MDXContent } = await evaluate(raw, {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug, [rehypeShikiFromHighlighter, highlighter, { theme: 'github-dark' }]],
      // evaluate demands Fragment/jsx/jsxs at the top level of options
      ...(jsxRuntime as unknown as Record<string, unknown>),
      // Resolve viewer components used in the document body
      useMDXComponents: () => docComponents,
    } as never)
    // Explicitly pass components so both evaluation paths resolve them
    const html = renderToStaticMarkup(createElement(MDXContent, { components: docComponents }))
    // Legacy docs (no viewer components) get the HTML post-processing;
    // component-based docs are already deterministic.
    const usesComponents = /<Block|<CodeBlock|<LineNotes|<Note\b/.test(raw)
    return { ok: true, html: usesComponents ? html : postProcessHtml(html) }
  } catch (err) {
    return { ok: false, html: '', error: String(err) }
  }
}
