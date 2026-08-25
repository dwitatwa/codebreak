import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveInput } from '../src/inputs/resolve.js'

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-resolve-'))
}

describe('resolveInput', () => {
  it('path file yang ada → mode file', () => {
    const dir = tmpDir()
    const file = path.join(dir, 'a.ts')
    fs.writeFileSync(file, 'x')
    const req = resolveInput({ positional: file })
    expect(req.kind).toBe('file')
  })

  it('path folder yang ada → mode file (direktori)', () => {
    const dir = tmpDir()
    const req = resolveInput({ positional: dir })
    expect(req.kind).toBe('file')
    if (req.kind === 'file') expect(req.target).toBe(fs.realpathSync(dir))
  })

  it('posisional yang tidak ada di disk → description', () => {
    const req = resolveInput({ positional: 'user authentication flow' })
    expect(req.kind).toBe('description')
    expect((req as { text: string }).text).toBe('user authentication flow')
  })

  it('--changes menang atas posisional', () => {
    const req = resolveInput({ positional: 'apa aja', changes: true })
    expect(req.kind).toBe('changes')
  })

  it('--commit dipakai tanpa --changes', () => {
    const req = resolveInput({ commit: 'HEAD~1..HEAD' })
    expect(req.kind).toBe('commit')
    expect((req as { ref: string }).ref).toBe('HEAD~1..HEAD')
  })

  it('tanpa input → error dengan pesan jelas', () => {
    expect(() => resolveInput({})).toThrow(/Tentukan input/)
  })

  it('--changes + --commit bersamaan → error', () => {
    expect(() => resolveInput({ changes: true, commit: 'HEAD' })).toThrow(/salah satu saja/)
  })

  it('deskripsi berawalan seperti path tetap jadi description', () => {
    const req = resolveInput({ positional: 'how does src/auth work' })
    expect(req.kind).toBe('description')
  })
})
