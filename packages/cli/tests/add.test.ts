import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'bun:test'
import { parseAgentDoc } from '../src/commands/add.js'
import { writeAgentDoc } from '../src/render/mdx.js'

const DOC_WITH_FM = `---
title: Auth Flow
type: description
source: user question
locale: en
---

## Summary

- Login uses JWT
`

const DOC_PLAIN = `# Payment Webhook

## Summary

- Webhook validates the signature
`

const TODAY = new Date().toISOString().slice(0, 10)

describe('parseAgentDoc', () => {
  it('frontmatter present → preserved and normalized', () => {
    const { frontmatter, body } = parseAgentDoc(DOC_WITH_FM, {})
    expect(frontmatter.title).toBe('Auth Flow')
    expect(frontmatter.type).toBe('description')
    expect(frontmatter.source).toBe('user question')
    expect(frontmatter.locale).toBe('en')
    expect(frontmatter.model).toBe('external-agent')
    expect(frontmatter.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body.startsWith('## Summary')).toBe(true)
  })

  it('without frontmatter → title from first heading, type defaults to note', () => {
    const { frontmatter, body } = parseAgentDoc(DOC_PLAIN, {})
    expect(frontmatter.title).toBe('Payment Webhook')
    expect(frontmatter.type).toBe('note')
    expect(frontmatter.source).toBe('agent')
    expect(body.startsWith('# Payment Webhook')).toBe(true)
  })

  it('CLI flags override the file frontmatter', () => {
    const { frontmatter } = parseAgentDoc(DOC_WITH_FM, {
      title: 'New Title',
      type: 'CHANGES',
      source: 'git diff',
    })
    expect(frontmatter.title).toBe('New Title')
    expect(frontmatter.type).toBe('changes')
    expect(frontmatter.source).toBe('git diff')
  })

  it('unknown type → note; valid depth is kept, invalid is dropped', () => {
    const { frontmatter: a } = parseAgentDoc(DOC_PLAIN, { type: 'hacked' })
    expect(a.type).toBe('note')

    const withDepth = DOC_PLAIN.replace('# Payment Webhook', '# T\n\ndepth: block')
    const { frontmatter: b } = parseAgentDoc(withDepth, { depth: 'line' })
    expect(b.depth).toBe('line')

    const { frontmatter: c } = parseAgentDoc(DOC_PLAIN, { depth: 'nope' })
    expect(c.depth).toBeUndefined()
  })

  it('empty content → error', () => {
    expect(() => parseAgentDoc('   \n', {})).toThrow(/empty/)
  })

  it('broken frontmatter → discarded without crashing', () => {
    const broken = '---\n: : : not yaml\n---\n\n## Content\n- x'
    const { body } = parseAgentDoc(broken, {})
    expect(body).toContain('## Content')
  })
})

describe('writeAgentDoc', () => {
  it('writes a file with free-form frontmatter + collision suffix', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-add-'))
    const fm = { title: 'Agent Notes', type: 'note', date: TODAY, model: 'external-agent' }
    const first = writeAgentDoc(cwd, fm, '- one')
    const second = writeAgentDoc(cwd, fm, '- two')
    expect(first.relPath).toMatch(new RegExp(`${TODAY}-agent-notes\\.mdx$`))
    expect(second.relPath).toMatch(/agent-notes-2\.mdx$/)
    const content = fs.readFileSync(first.absPath, 'utf8')
    expect(content).toContain('model: external-agent')
    expect(content.trimEnd().endsWith('- one')).toBe(true)
    fs.rmSync(cwd, { recursive: true, force: true })
  })
})
