import { evaluate } from '@mdx-js/mdx'
import * as jsxRuntime from 'react/jsx-runtime'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import { createHighlighter, type Highlighter } from 'shiki'

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
 * Kompilasi MDX → HTML string di server.
 * Pipeline sama dengan era Vite (gfm + shiki + slug), dieksekusi in-process
 * sehingga bisa dibundel ke dalam binary.
 */
export async function renderDoc(raw: string): Promise<RenderedDoc> {
  try {
    const highlighter = await getHighlighter()
    const { default: MDXContent } = await evaluate(raw, {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug, [rehypeShikiFromHighlighter, highlighter, { theme: 'github-dark' }]],
      // evaluate menuntut Fragment/jsx/jsxs di level atas opsi
      ...(jsxRuntime as unknown as Record<string, unknown>),
    } as never)
    const html = renderToStaticMarkup(createElement(MDXContent))
    return { ok: true, html }
  } catch (err) {
    return { ok: false, html: '', error: String(err) }
  }
}
