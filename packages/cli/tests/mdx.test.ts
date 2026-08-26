import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'bun:test'
import { emitDoc, extractTldr, sanitizeBody, slugify } from '../src/render/mdx.js'
import type { DocFrontmatter } from '../src/render/mdx.js'

const TODAY = new Date().toISOString().slice(0, 10)

const FM: DocFrontmatter = {
  title: 'Local Changes',
  type: 'changes',
  source: 'local changes',
  date: TODAY,
  model: 'test-model',
  depth: 'block',
  locale: 'id',
}

function tmpCwd(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-mdx-'))
}

describe('slugify', () => {
  it('clean slug', () => {
    expect(slugify('Local Changes (3 files)')).toBe('local-changes-3-files')
  })
  it('fallback when empty', () => {
    expect(slugify('???')).toBe('explain')
  })
})

describe('emitDoc', () => {
  it('writes a file with valid frontmatter', () => {
    const cwd = tmpCwd()
    const doc = emitDoc(cwd, '# content\n\nhello', FM)
    expect(fs.existsSync(doc.absPath)).toBe(true)
    expect(doc.relPath).toMatch(new RegExp(`^\\.codebreak[/\\\\]docs[/\\\\]${TODAY}-local-changes\\.mdx$`))
    const content = fs.readFileSync(doc.absPath, 'utf8')
    expect(content.startsWith('---\n')).toBe(true)
    expect(content).toContain('title: Local Changes')
    expect(content).toContain('depth: block')
    expect(content.trimEnd().endsWith('hello')).toBe(true)
  })

  it('name collision → -2 suffix', () => {
    const cwd = tmpCwd()
    emitDoc(cwd, 'a', FM)
    const second = emitDoc(cwd, 'b', FM)
    expect(second.relPath).toMatch(/-2\.mdx$/)
  })
})

describe('sanitizeBody', () => {
  it('strips frontmatter smuggled in by the model', () => {
    const body = sanitizeBody('---\ntitle: x\n---\n\n## Summary\n- a')
    expect(body.startsWith('## Summary')).toBe(true)
  })

  it('strips an intact wrapping fence', () => {
    const body = sanitizeBody('```markdown\n## Summary\n```\n')
    expect(body).toBe('## Summary')
  })

  it('normal body is left unchanged', () => {
    expect(sanitizeBody('  ## Summary  ')).toBe('## Summary')
  })
})

describe('extractTldr', () => {
  it('extracts the Summary section', () => {
    const body = '## Summary\n- one\n- two\n\n## File: a.ts\ncontent'
    expect(extractTldr(body)).toBe('- one\n- two')
  })

  it('also recognizes Summary (en)', () => {
    const body = '## Summary\n- one\n\n## Notes\nn'
    expect(extractTldr(body)).toBe('- one')
  })

  it('empty when missing', () => {
    expect(extractTldr('no heading')).toBe('')
  })
})
