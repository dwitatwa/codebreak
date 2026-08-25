import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import pc from 'picocolors'
import { CodebreakError } from '../errors.js'
import skillMarkdown from '../../../../skills/codebreak/SKILL.md'

/**
 * SKILL.md di-inline oleh loader .md (preload bunfig saat dev, Bun.build saat compile)
 * sehingga binary tetap membawa skill tanpa file eksternal.
 */
const skillText = String(skillMarkdown)

function loadSkillText(): string {
  return skillText
}

export type SkillTarget = 'project' | 'user'

const VALID_TARGETS: SkillTarget[] = ['project', 'user']

interface InstallPlan {
  label: string
  write(): string
}

function writeFilePlan(label: string, absPath: string, content: string): InstallPlan {
  return {
    label,
    write() {
      fs.mkdirSync(path.dirname(absPath), { recursive: true })
      fs.writeFileSync(absPath, content, 'utf8')
      return absPath
    },
  }
}

function buildPlans(targets: Set<SkillTarget>, skillText: string, baseDir: string): InstallPlan[] {
  const plans: InstallPlan[] = []

  if (targets.has('project')) {
    plans.push(
      writeFilePlan('project (.agents/skills)', path.join(baseDir, '.agents', 'skills', 'codebreak', 'SKILL.md'), skillText),
    )
  }
  if (targets.has('user')) {
    // ~/.agents/skills is the generic user-level location many harnesses pick up
    plans.push(writeFilePlan('user (~/.agents/skills)', path.join(os.homedir(), '.agents', 'skills', 'codebreak', 'SKILL.md'), skillText))
  }
  return plans
}

/** Artifacts the installer writes inside a project (used by `codebreak remove`) */
export function projectSkillArtifacts(baseDir: string): { path: string; label: string }[] {
  return [
    { path: path.join(baseDir, '.agents', 'skills', 'codebreak'), label: 'project (.agents/skills)' },
  ]
}

export function runSkillInstall(targetsArg: string[] | undefined, baseDir = process.cwd()): void {
  const targets = new Set<SkillTarget>(
    targetsArg && targetsArg.length > 0
      ? targetsArg.map((t) => t.toLowerCase() as SkillTarget)
      : VALID_TARGETS,
  )
  for (const t of targets) {
    if (!VALID_TARGETS.includes(t)) {
      throw new CodebreakError(`Unknown target: "${t}" (choices: ${VALID_TARGETS.join(', ')})`)
    }
  }

  const skillText = loadSkillText()

  console.log(`Installing codebreak skill (${[...targets].join(', ')}) into ${baseDir}:`)
  for (const plan of buildPlans(targets, skillText, baseDir)) {
    try {
      const written = plan.write()
      console.log(`  ${pc.green('✓')} ${plan.label} — ${pc.dim(written)}`)
    } catch (err) {
      console.log(`  ${pc.red('✗')} ${plan.label} — ${(err as Error).message}`)
    }
  }
  console.log()
  console.log(pc.dim('The skill teaches agents to write docs and save them via `codebreak add`.'))
}

export function runSkillShow(): void {
  process.stdout.write(loadSkillText())
}
