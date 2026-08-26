import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import { findGitRoot } from '../git/repo.js'
import { projectSkillArtifacts } from './skill.js'

export interface RemoveOptions {
  docs?: boolean
  all?: boolean
  keepSkills?: boolean
}

function rmRfIfExist(target: string): boolean {
  if (!fs.existsSync(target)) return false
  fs.rmSync(target, { recursive: true, force: true })
  return true
}

/**
 * Remove codebreak integration from this project (inverse of `codebreak init`).
 * Conservative: docs & config are not deleted unless explicitly requested.
 */
export function runRemove(opts: RemoveOptions): void {
  const cwd = process.cwd()
  const root = findGitRoot(cwd) ?? cwd
  const cbDir = path.join(root, '.codebreak')

  if (opts.all) {
    if (rmRfIfExist(cbDir)) {
      console.log(`${pc.green('✓')} Removed the entire ${pc.dim('.codebreak/')} folder`)
    } else {
      console.log(pc.dim('.codebreak/ does not exist.'))
    }
    return
  }

  // Project config
  const configFile = path.join(cbDir, 'config.json')
  if (rmRfIfExist(configFile)) {
    console.log(`${pc.green('✓')} Removed ${pc.dim(path.relative(cwd, configFile) || configFile)}`)
  }

  // Docs when explicitly requested
  if (opts.docs && rmRfIfExist(path.join(cbDir, 'docs'))) {
    console.log(`${pc.green('✓')} Removed ${pc.dim('.codebreak/docs/')}`)
  }
  if (opts.docs) {
    try {
      const rest = fs.readdirSync(cbDir)
      if (rest.length === 0) fs.rmdirSync(cbDir)
    } catch {
      // folder no longer exists
    }
  }

  // Artifacts the skill installer wrote inside this project
  if (!opts.keepSkills) {
    for (const artifact of projectSkillArtifacts(root)) {
      if (rmRfIfExist(artifact.path)) {
        console.log(`${pc.green('✓')} Removed ${pc.dim(path.relative(cwd, artifact.path) || artifact.path)} (${artifact.label})`)
      }
    }
  }

  console.log()
  console.log(pc.dim('Project integration removed. The global binary & user config were left untouched.'))
}
