import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { loadConfig, projectConfigPath, userConfigPath } from '../src/config.js'
import { binScriptName } from '../src/util/platform.js'

const ORIG_CWD = process.cwd()
const savedEnv = { ...process.env }

function makeProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-cfg-'))
  // git repo marker (findGitRoot only checks for the presence of .git)
  fs.mkdirSync(path.join(dir, '.git'))
  return dir
}

describe('layered config', () => {
  let userHome: string
  let project: string

  beforeAll(() => {
    userHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-home-'))
    project = makeProject()
    process.env.XDG_CONFIG_HOME = path.join(userHome, '.config')
    fs.mkdirSync(path.dirname(userConfigPath()), { recursive: true })
    fs.writeFileSync(
      userConfigPath(),
      JSON.stringify({ provider: { model: 'user-model' }, outputLocale: 'en', depth: 'overview' }),
    )
    process.chdir(project)
  })

  afterEach(() => {
    const projCfg = projectConfigPath()
    if (projCfg) fs.rmSync(projCfg, { force: true })
    for (const env of ['CODEBREAK_MODEL', 'CODEBREAK_BASE_URL']) delete process.env[env]
  })

  afterAll(() => {
    process.chdir(ORIG_CWD)
    process.env.XDG_CONFIG_HOME = savedEnv.XDG_CONFIG_HOME
    fs.rmSync(project, { recursive: true, force: true })
    fs.rmSync(userHome, { recursive: true, force: true })
  })

  it('no project config → user values are used', () => {
    expect(loadConfig().provider.model).toBe('user-model')
    expect(loadConfig().outputLocale).toBe('en')
  })

  it('project config overrides some user values', () => {
    fs.mkdirSync(path.join(project, '.codebreak'), { recursive: true })
    fs.writeFileSync(
      projectConfigPath()!,
      JSON.stringify({ provider: { model: 'project-model' }, depth: 'line' }),
    )
    const cfg = loadConfig()
    expect(cfg.provider.model).toBe('project-model')
    // values that are not overridden fall back to the user layer
    expect(cfg.outputLocale).toBe('en')
    expect(cfg.depth).toBe('line')
  })

  it('env wins over everything else', () => {
    fs.mkdirSync(path.join(project, '.codebreak'), { recursive: true })
    process.env.CODEBREAK_MODEL = 'env-model'
    expect(loadConfig().provider.model).toBe('env-model')
  })

  it('outside a repo → no project layer', () => {
    process.chdir(os.tmpdir())
    expect(projectConfigPath()).toBeNull()
    process.chdir(project)
  })
})

describe('binScriptName', () => {
  it('on linux without the .cmd suffix', () => {
    if (process.platform !== 'win32') {
      expect(binScriptName('vite')).toBe('vite')
    }
  })
})
