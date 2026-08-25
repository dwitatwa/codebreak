import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import { loadConfig } from '../config.js'
import { CodebreakError } from '../errors.js'
import { findGitRoot } from '../git/repo.js'
import { runSkillInstall } from './skill.js'

export interface InitOptions {
  force?: boolean
  skills?: string
  noSkills?: boolean
  noGitignore?: boolean
}

const DEFAULT_INIT_SKILLS = 'project'

function ensureGitignoreEntry(gitignorePath: string, entry: string): boolean {
  let existing = ''
  try {
    existing = fs.readFileSync(gitignorePath, 'utf8')
  } catch {
    existing = ''
  }
  const alreadyThere = existing
    .split(/\r?\n/)
    .some((line) => line.trim() === entry)
  if (alreadyThere) return false

  const sep = existing.endsWith('\n') || existing === '' ? '' : '\n'
  fs.writeFileSync(gitignorePath, `${existing}${sep}${entry}\n`, 'utf8')
  return true
}

/**
 * Opt-in codebreak untuk sebuah project:
 * config project (.codebreak/config.json) + skill harness + gitignore docs.
 */
export async function runInit(opts: InitOptions): Promise<void> {
  const cwd = process.cwd()
  const root = findGitRoot(cwd) ?? cwd

  // 1. Config project — salin config efektif supaya mudah diedit khusus project ini
  const configDir = path.join(root, '.codebreak')
  const configFile = path.join(configDir, 'config.json')
  if (fs.existsSync(configFile) && !opts.force) {
    throw new CodebreakError(
      `${configFile} already exists.\nUse --force to overwrite it, or edit the file directly.`,
    )
  }
  const effective = loadConfig()
  const projectCfg = {
    provider: effective.provider,
    outputLocale: effective.outputLocale,
    depth: effective.depth,
  }
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(configFile, JSON.stringify(projectCfg, null, 2) + '\n', 'utf8')
  console.log(`${pc.green('✓')} Project config — ${pc.dim(path.relative(cwd, configFile) || configFile)}`)

  // 2. Harness skill inside this project
  if (!opts.noSkills) {
    const targets = (opts.skills ?? DEFAULT_INIT_SKILLS).split(',').map((t) => t.trim()).filter(Boolean)
    console.log()
    runSkillInstall(targets, root)
  }

  // 3. Ignore docs in git (local artifacts)
  if (!opts.noGitignore) {
    const gitignorePath = path.join(root, '.gitignore')
    if (ensureGitignoreEntry(gitignorePath, '.codebreak/docs/')) {
      console.log(`${pc.green('✓')} .gitignore — added ${pc.dim('.codebreak/docs/')}`)
    } else {
      console.log(`${pc.green('✓')} .gitignore — ${pc.dim('.codebreak/docs/')} already listed`)
    }
  }

  console.log()
  console.log(pc.bold(`This project is ready to use codebreak.`))
  console.log(pc.dim(`Edit this project's model/provider in ${path.relative(cwd, configFile) || configFile}`))
  console.log(pc.dim(`Then: codebreak explain "..." · or ask an agent to save docs via codebreak add`))
}
