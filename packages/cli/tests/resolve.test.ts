import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'bun:test'
import { resolveInput } from '../src/inputs/resolve.js'

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-resolve-'))
}

describe('resolveInput', () => {
  it('existing file path → file mode', () => {
    const dir = tmpDir()
    const file = path.join(dir, 'a.ts')
    fs.writeFileSync(file, 'x')
    const req = resolveInput({ positional: file })
    expect(req.kind).toBe('file')
  })

  it('existing folder path → file mode (directory)', () => {
    const dir = tmpDir()
    const req = resolveInput({ positional: dir })
    expect(req.kind).toBe('file')
    if (req.kind === 'file') expect(req.target).toBe(fs.realpathSync(dir))
  })

  it('positional that does not exist on disk → description', () => {
    const req = resolveInput({ positional: 'user authentication flow' })
    expect(req.kind).toBe('description')
    expect((req as { text: string }).text).toBe('user authentication flow')
  })

  it('--changes wins over positional', () => {
    const req = resolveInput({ positional: 'anything at all', changes: true })
    expect(req.kind).toBe('changes')
  })

  it('--commit is used without --changes', () => {
    const req = resolveInput({ commit: 'HEAD~1..HEAD' })
    expect(req.kind).toBe('commit')
    expect((req as { ref: string }).ref).toBe('HEAD~1..HEAD')
  })

  it('no input → error with a clear message', () => {
    expect(() => resolveInput({})).toThrow(/Provide an input/)
  })

  it('--changes + --commit together → error', () => {
    expect(() => resolveInput({ changes: true, commit: 'HEAD' })).toThrow(/only one of/)
  })

  it('description that looks like a path stays a description', () => {
    const req = resolveInput({ positional: 'how does src/auth work' })
    expect(req.kind).toBe('description')
  })
})
