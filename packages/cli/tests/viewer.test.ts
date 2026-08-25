import { describe, expect, it } from 'bun:test'
import { renderDoc, postProcessHtml } from '../src/viewer/render-docs.js'
import { extractDocFiles } from '../src/viewer/server.js'

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
      '    <Note line="1">Queries the user.</Note>',
      '    <Note line="2">Stops on missing user.</Note>',
      '  </LineNotes>',
      '</Block>',
    ].join('\n')

    const res = await renderDoc(md)
    expect(res.ok).toBe(true)
    const html = res.html
    expect(html).toContain('cb-block')
    expect(html).toContain('cb-code')
    expect(html).toContain('cb-note')
    expect(html).toContain('data-line="1"')
    expect(html).toContain('data-line="2"')
    expect(html).toContain('handleLogin')
    // code line text preserved
    expect(html).toContain('await findUser(email)')
  })

  it('renders a plain markdown doc (legacy) without error', async () => {
    const res = await renderDoc('## Summary\n\n- point\n\n### file.ts\n\nSome prose here.')
    expect(res.ok).toBe(true)
    expect(res.html).toContain('Summary')
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
