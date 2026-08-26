import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { simpleGit } from 'simple-git'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { gatherChangesContext, gatherCommitContext } from '../src/core/gatherers.js'

let repoDir: string

async function makeRepo(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-git-'))
  const git = simpleGit({ baseDir: dir })
  await git.init(['-b', 'main'])
  await git.addConfig('user.email', 'test@codebreak.local')
  await git.addConfig('user.name', 'Codebreak Test')
  return dir
}

describe('git layer (fixture repository)', () => {
  beforeAll(async () => {
    repoDir = await makeRepo()
    const git = simpleGit({ baseDir: repoDir })
    fs.writeFileSync(path.join(repoDir, 'a.ts'), 'export const a = 1\n')
    await git.add('a.ts')
    await git.commit('first commit')
    fs.writeFileSync(path.join(repoDir, 'b.ts'), 'export const b = 2\n')
    await git.add('b.ts')
    await git.commit('second commit')
  })

  it('gatherChanges: clean tree → informative error', async () => {
    await expect(
      gatherChangesContext(repoDir, { maxContextChars: 10_000 }),
    ).rejects.toThrow(/nothing to explain/i)
  })

  it('gatherChanges: unstaged changes are detected', async () => {
    fs.writeFileSync(path.join(repoDir, 'a.ts'), 'export const a = 2\n')
    const ctx = await gatherChangesContext(repoDir, { maxContextChars: 10_000 })
    expect(ctx.kind).toBe('changes')
    expect(ctx.material).toContain('+export const a = 2')
  })

  it('gatherChanges: untracked files are included as content', async () => {
    fs.writeFileSync(path.join(repoDir, 'new.ts'), 'export const fresh = true\n')
    const ctx = await gatherChangesContext(repoDir, { maxContextChars: 20_000 })
    expect(ctx.material).toContain('New file (untracked): new.ts')
    expect(ctx.material).toContain('export const fresh = true')
    // clean up so the next test stays deterministic
    fs.rmSync(path.join(repoDir, 'new.ts'))
  })

  it('gatherCommit: single ref HEAD', async () => {
    const ctx = await gatherCommitContext(repoDir, 'HEAD', { maxContextChars: 20_000 })
    expect(ctx.sourceLabel).toBe('commit HEAD')
    expect(ctx.title).toContain('second commit')
    expect(ctx.material).toContain('export const b = 2')
  })

  it('gatherCommit: range HEAD~1..HEAD; fake ref → error', async () => {
    const ctx = await gatherCommitContext(repoDir, 'HEAD~1..HEAD', { maxContextChars: 20_000 })
    expect(ctx.kind).toBe('commit')
    expect(ctx.material).toContain('+export const b = 2')
    expect(ctx.material).toContain('second commit')

    await expect(gatherCommitContext(repoDir, 'no-such-ref', { maxContextChars: 100 })).rejects.toThrow(
      /Unknown git ref/,
    )
  })

  it('extension filter removes non-matching untracked files', async () => {
    fs.writeFileSync(path.join(repoDir, 'notes.md'), '# notes\n')
    const ctx = await gatherChangesContext(repoDir, {
      extensions: new Set(['.ts']),
      maxContextChars: 20_000,
    })
    expect(ctx.material).not.toContain('# notes')
    fs.rmSync(path.join(repoDir, 'notes.md'))
  })

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true })
  })
})
