import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { runInit } from '../src/commands/init.js'
import { runRemove } from '../src/commands/remove.js'

const ORIG_CWD = process.cwd()
let project: string
let gitignorePath: string

beforeAll(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-init-'))
  fs.mkdirSync(path.join(project, '.git'))
  gitignorePath = path.join(project, '.gitignore')
  process.chdir(project)
})

afterAll(() => {
  process.chdir(ORIG_CWD)
  fs.rmSync(project, { recursive: true, force: true })
})

describe('codebreak init', () => {
  it('creates project config + skill + gitignore entry', async () => {
    await runInit({ skills: 'project' }) // minimal target so the test stays fast

    const cfgFile = path.join(project, '.codebreak', 'config.json')
    expect(fs.existsSync(cfgFile)).toBe(true)
    const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')) as Record<string, unknown>
    expect(cfg.provider).toBeTruthy()

    expect(
      fs.existsSync(path.join(project, '.agents', 'skills', 'codebreak', 'SKILL.md')),
    ).toBe(true)
    expect(fs.readFileSync(gitignorePath, 'utf8')).toContain('.codebreak/docs/')
  })

  it('idempotent for gitignore, but config requires --force', async () => {
    await expect(runInit({ skills: 'project' })).rejects.toThrow(/already exists/)

    const before = fs.readFileSync(gitignorePath, 'utf8')
    await runInit({ force: true, skills: 'project' })
    const after = fs.readFileSync(gitignorePath, 'utf8')
    // does not duplicate the gitignore entry
    expect(after.split('.codebreak/docs/').length - 1).toBe(
      before.split('.codebreak/docs/').length - 1,
    )
  })
})

describe('codebreak remove', () => {
  it('removes config & skill artifacts, docs are kept by default', async () => {
    // plant a fake document to make sure it is not deleted
    fs.mkdirSync(path.join(project, '.codebreak', 'docs'), { recursive: true })
    fs.writeFileSync(path.join(project, '.codebreak', 'docs', 'x.mdx'), '# x')

    runRemove({ keepSkills: false })

    expect(fs.existsSync(path.join(project, '.codebreak', 'config.json'))).toBe(false)
    // only codebreak's own subfolder is removed; parents are left alone
    expect(fs.existsSync(path.join(project, '.agents', 'skills', 'codebreak'))).toBe(false)
    expect(fs.existsSync(path.join(project, '.codebreak', 'docs', 'x.mdx'))).toBe(true)
  })

  it('--all removes the entire .codebreak/', () => {
    runRemove({ all: true })
    expect(fs.existsSync(path.join(project, '.codebreak'))).toBe(false)
  })
})
