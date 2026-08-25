import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'bun:test'
import { emitDoc, extractTldr, sanitizeBody, slugify } from '../src/render/mdx.js'
import type { DocFrontmatter } from '../src/render/mdx.js'

const FM: DocFrontmatter = {
  title: 'Local Changes',
  type: 'changes',
  source: 'local changes',
  date: '2026-08-25',
  model: 'test-model',
  depth: 'block',
  locale: 'id',
}

function tmpCwd(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-mdx-'))
}

describe('slugify', () => {
  it('slug bersih', () => {
    expect(slugify('Local Changes (3 files)')).toBe('local-changes-3-files')
  })
  it('fallback kalau kosong', () => {
    expect(slugify('???')).toBe('explain')
  })
})

describe('emitDoc', () => {
  it('menulis file dengan frontmatter valid', () => {
    const cwd = tmpCwd()
    const doc = emitDoc(cwd, '# isi\n\nhalo', FM)
    expect(fs.existsSync(doc.absPath)).toBe(true)
    expect(doc.relPath).toMatch(/^\.codebreak[/\\]docs[/\\]2026-08-25-local-changes\.mdx$/)
    const content = fs.readFileSync(doc.absPath, 'utf8')
    expect(content.startsWith('---\n')).toBe(true)
    expect(content).toContain('title: Local Changes')
    expect(content).toContain('depth: block')
    expect(content.trimEnd().endsWith('halo')).toBe(true)
  })

  it('tabrakan nama → sufiks -2', () => {
    const cwd = tmpCwd()
    emitDoc(cwd, 'a', FM)
    const second = emitDoc(cwd, 'b', FM)
    expect(second.relPath).toMatch(/-2\.mdx$/)
  })
})

describe('sanitizeBody', () => {
  it('membuang frontmatter yang diselundupkan model', () => {
    const body = sanitizeBody('---\ntitle: x\n---\n\n## Ringkasan\n- a')
    expect(body.startsWith('## Ringkasan')).toBe(true)
  })

  it('membuang fence pembungkus utuh', () => {
    const body = sanitizeBody('```markdown\n## Ringkasan\n```\n')
    expect(body).toBe('## Ringkasan')
  })

  it('body normal tidak berubah', () => {
    expect(sanitizeBody('  ## Ringkasan  ')).toBe('## Ringkasan')
  })
})

describe('extractTldr', () => {
  it('mengambil seksi Ringkasan', () => {
    const body = '## Ringkasan\n- satu\n- dua\n\n## File: a.ts\nisi'
    expect(extractTldr(body)).toBe('- satu\n- dua')
  })

  it('juga mengenali Summary (en)', () => {
    const body = '## Summary\n- one\n\n## Notes\nn'
    expect(extractTldr(body)).toBe('- one')
  })

  it('kosong bila tidak ada', () => {
    expect(extractTldr('tanpa heading')).toBe('')
  })
})
