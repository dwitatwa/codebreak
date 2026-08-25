import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'bun:test'
import { parseAgentDoc } from '../src/commands/add.js'
import { writeAgentDoc } from '../src/render/mdx.js'

const DOC_WITH_FM = `---
title: Auth Flow
type: description
source: pertanyaan user
locale: id
---

## Ringkasan

- Login memakai JWT
`

const DOC_PLAIN = `# Payment Webhook

## Ringkasan

- Webhook memvalidasi signature
`

describe('parseAgentDoc', () => {
  it('frontmatter ada → dipertahankan dan dinormalisasi', () => {
    const { frontmatter, body } = parseAgentDoc(DOC_WITH_FM, {})
    expect(frontmatter.title).toBe('Auth Flow')
    expect(frontmatter.type).toBe('description')
    expect(frontmatter.source).toBe('pertanyaan user')
    expect(frontmatter.locale).toBe('id')
    expect(frontmatter.model).toBe('external-agent')
    expect(frontmatter.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body.startsWith('## Ringkasan')).toBe(true)
  })

  it('tanpa frontmatter → title dari heading pertama, type default note', () => {
    const { frontmatter, body } = parseAgentDoc(DOC_PLAIN, {})
    expect(frontmatter.title).toBe('Payment Webhook')
    expect(frontmatter.type).toBe('note')
    expect(frontmatter.source).toBe('agent')
    expect(body.startsWith('# Payment Webhook')).toBe(true)
  })

  it('flag CLI menimpa frontmatter file', () => {
    const { frontmatter } = parseAgentDoc(DOC_WITH_FM, {
      title: 'Judul Baru',
      type: 'CHANGES',
      source: 'git diff',
    })
    expect(frontmatter.title).toBe('Judul Baru')
    expect(frontmatter.type).toBe('changes')
    expect(frontmatter.source).toBe('git diff')
  })

  it('type tak dikenal → note; depth valid ikut, tidak valid dibuang', () => {
    const { frontmatter: a } = parseAgentDoc(DOC_PLAIN, { type: 'hacked' })
    expect(a.type).toBe('note')

    const withDepth = DOC_PLAIN.replace('# Payment Webhook', '# T\n\ndepth: block')
    const { frontmatter: b } = parseAgentDoc(withDepth, { depth: 'line' })
    expect(b.depth).toBe('line')

    const { frontmatter: c } = parseAgentDoc(DOC_PLAIN, { depth: 'nope' })
    expect(c.depth).toBeUndefined()
  })

  it('konten kosong → error', () => {
    expect(() => parseAgentDoc('   \n', {})).toThrow(/empty/)
  })

  it('frontmatter rusak → dibuang tanpa crash', () => {
    const broken = '---\n: : : bukan yaml\n---\n\n## Isi\n- x'
    const { body } = parseAgentDoc(broken, {})
    expect(body).toContain('## Isi')
  })
})

describe('writeAgentDoc', () => {
  it('menulis file dengan frontmatter bebas + collision suffix', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-add-'))
    const fm = { title: 'Agent Notes', type: 'note', date: '2026-08-25', model: 'external-agent' }
    const first = writeAgentDoc(cwd, fm, '- satu')
    const second = writeAgentDoc(cwd, fm, '- dua')
    expect(first.relPath).toMatch(/2026-08-25-agent-notes\.mdx$/)
    expect(second.relPath).toMatch(/agent-notes-2\.mdx$/)
    const content = fs.readFileSync(first.absPath, 'utf8')
    expect(content).toContain('model: external-agent')
    expect(content.trimEnd().endsWith('- satu')).toBe(true)
    fs.rmSync(cwd, { recursive: true, force: true })
  })
})
