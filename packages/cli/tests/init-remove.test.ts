import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
  it('membuat config project + skill + entri gitignore', async () => {
    await runInit({ skills: 'project' }) // target minimal supaya test cepat

    const cfgFile = path.join(project, '.codebreak', 'config.json')
    expect(fs.existsSync(cfgFile)).toBe(true)
    const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')) as Record<string, unknown>
    expect(cfg.provider).toBeTruthy()

    expect(
      fs.existsSync(path.join(project, '.agents', 'skills', 'codebreak', 'SKILL.md')),
    ).toBe(true)
    expect(fs.readFileSync(gitignorePath, 'utf8')).toContain('.codebreak/docs/')
  })

  it('idempoten pada gitignore, tapi config butuh --force', async () => {
    await expect(runInit({ skills: 'project' })).rejects.toThrow(/sudah ada/)

    const before = fs.readFileSync(gitignorePath, 'utf8')
    await runInit({ force: true, skills: 'project' })
    const after = fs.readFileSync(gitignorePath, 'utf8')
    // tidak menduplikasi entri gitignore
    expect(after.split('.codebreak/docs/').length - 1).toBe(
      before.split('.codebreak/docs/').length - 1,
    )
  })
})

describe('codebreak remove', () => {
  it('menghapus config & artefak skill, docs dipertahankan secara default', async () => {
    // siapkan dokumen palsu untuk memastikan tidak ikut terhapus
    fs.mkdirSync(path.join(project, '.codebreak', 'docs'), { recursive: true })
    fs.writeFileSync(path.join(project, '.codebreak', 'docs', 'x.mdx'), '# x')

    runRemove({ keepSkills: false })

    expect(fs.existsSync(path.join(project, '.codebreak', 'config.json'))).toBe(false)
    // only codebreak's own subfolder is removed; parents are left alone
    expect(fs.existsSync(path.join(project, '.agents', 'skills', 'codebreak'))).toBe(false)
    expect(fs.existsSync(path.join(project, '.codebreak', 'docs', 'x.mdx'))).toBe(true)
  })

  it('--all menghapus seluruh .codebreak/', () => {
    runRemove({ all: true })
    expect(fs.existsSync(path.join(project, '.codebreak'))).toBe(false)
  })
})
