import { describe, expect, it } from 'bun:test'
import { renderDoc, postProcessHtml } from '../src/viewer/render-docs.js'
import { extractDocFiles } from '../src/viewer/server.js'
import { parseLineRange } from '../src/viewer/components.js'

describe('renderDoc — viewer components', () => {
  it('renders <Block><CodeBlock><LineNotes><Note> into classed HTML', async () => {
    const md = [
      '### src/auth/login.ts',
      '',
      '<Block name="handleLogin" lines="12-40">',
      '  <CodeBlock lang="ts">',
      '',
      '    ```ts',
      '    const user = await findUser(email)',
      '    if (!user) throw new NotFoundError()',
      '    ```',
      '',
      '  </CodeBlock>',
      '  <LineNotes>',
      '    <Note line="12">Queries the user.</Note>',
      '    <Note line="13">Stops on missing user.</Note>',
      '  </LineNotes>',
      '</Block>',
    ].join('\n')

    const res = await renderDoc(md)
    expect(res.ok).toBe(true)
    const html = res.html
    expect(html).toContain('cb-block')
    expect(html).toContain('cb-code')
    expect(html).toContain('cb-code-line--noted')
    expect(html).toContain('data-note="Queries the user."')
    expect(html).toContain('data-note="Stops on missing user."')
    // the below-list is gone — notes live as hover data on the code lines
    expect(html).not.toContain('cb-notes')
    expect(html).toContain('data-line="12"')
    expect(html).toContain('handleLogin')
    // code line text preserved
    expect(html).toContain('await findUser(email)')
  })

  it('numbers the code gutter from the block start line (real file lines)', async () => {
    const md = [
      '<Block name="fn" lines="28-30">',
      '  <CodeBlock lang="ts">',
      '',
      '    ```ts',
      '    aaa',
      '    bbb',
      '    ccc',
      '    ```',
      '',
      '  </CodeBlock>',
      '</Block>',
    ].join('\n')

    const res = await renderDoc(md)
    expect(res.ok).toBe(true)
    const html = res.html
    // gutter shows real file lines 28, 29, 30 (not 1, 2, 3)
    expect(html).toContain('data-line="28"')
    expect(html).toContain('data-line="29"')
    expect(html).toContain('data-line="30"')
    expect(html).not.toContain('data-line="1"')
    // visible numbers rendered
    expect(html).toMatch(/cb-code-num">28</)
  })

  it('renders the block summary line and data-line-start', async () => {
    const md = [
      '<Block name="fn" lines="28-30" summary="Does the thing.">',
      '  <CodeBlock lang="ts">',
      '',
      '    ```ts',
      '    aaa',
      '    bbb',
      '    ```',
      '',
      '  </CodeBlock>',
      '</Block>',
    ].join('\n')
    const res = await renderDoc(md)
    expect(res.ok).toBe(true)
    expect(res.html).toContain('cb-block-desc')
    expect(res.html).toContain('Does the thing.')
    expect(res.html).toContain('data-line-start="28"')
  })

  it('renders a plain markdown doc (legacy) without error', async () => {
    const res = await renderDoc('## Summary\n\n- point\n\n### file.ts\n\nSome prose here.')
    expect(res.ok).toBe(true)
    expect(res.html).toContain('Summary')
  })

  it('falls back to plain markdown (degraded) when MDX compilation fails', async () => {
    // stray `{` cannot be fixed by escaping < — MDX compilation fails
    const res = await renderDoc('## Summary\n\nan unclosed brace { breaks MDX too')
    expect(res.ok).toBe(true)
    expect(res.degraded).toBe(true)
    expect(res.error).toBeTruthy()
    expect(res.html).toContain('<h2')
    expect(res.html).toContain('Summary')
    expect(res.html).toContain('unclosed brace')
  })
})

describe('parseLineRange', () => {
  it('parses "12-40" and "12"', () => {
    expect(parseLineRange('12-40')).toEqual([12, 40])
    expect(parseLineRange('12')).toEqual([12, 12])
    expect(parseLineRange('12 – 40')).toEqual([12, 40])
    expect(parseLineRange(undefined)).toBeNull()
    expect(parseLineRange('abc')).toBeNull()
  })
})

describe('postProcessHtml — legacy docs only', () => {
  it('labels What/Why/Details and collapses blocks', () => {
    const html =
      '<p><strong>What</strong></p>\n<p>x</p><details open><summary>A</summary></details><details open><summary>B</summary></details>'
    const out = postProcessHtml(html)
    expect(out).toContain('cb-label-what')
    expect(out.match(/<details open>/g)?.length ?? 0).toBe(1)
  })
})

describe('extractDocFiles', () => {
  it('collects ### file-path headings', () => {
    const body = '### src/auth/login.ts\n\n### src/pay/payment.ts\n'
    expect(extractDocFiles(body)).toEqual(['src/auth/login.ts', 'src/pay/payment.ts'])
  })
})
